import EventEmitter from 'safe-event-emitter';
import log from 'loglevel';
import EthQuery from 'ethjs-query';
import BN from 'bn.js';
import {
  THETAMAINNET_NATIVE_RPC_URL,
  THETAMAINNET_NETWORK_ID,
  THETA_GASPRICE_HEXWEI,
} from '../network/enums';
import { hexToBn } from '../../lib/util';
import request from 'request';

/**

  Event emitter utility class for tracking the transactions as they<br>
  go from a pending state to a confirmed (mined in a block) state<br>
<br>
  As well as continues broadcast while in the pending state
<br>
@param {Object} config - non optional configuration object consists of:
    @param {Object} config.provider - A network provider.
    @param {Object} config.nonceTracker see nonce tracker
    @param {function} config.getPendingTransactions a function for getting an array of transactions,
    @param {function} config.publishTransaction a async function for publishing raw transactions,

@class
*/

export default class PendingTransactionTracker extends EventEmitter {
  /**
   * We wait this many blocks before emitting a 'tx:dropped' event
   *
   * This is because we could be talking to a node that is out of sync.
   *
   * @type {number}
   */
  DROPPED_BUFFER_COUNT = 3;

  /**
   * A map of transaction hashes to the number of blocks we've seen
   * since first considering it dropped
   *
   * @type {Map<String, number>}
   */
  droppedBlocksBufferByHash = new Map();

  constructor(config) {
    super();
    this.query = config.query || new EthQuery(config.provider);
    this.nonceTracker = config.nonceTracker;
    this.getPendingTransactions = config.getPendingTransactions;
    this.getCompletedTransactions = config.getCompletedTransactions;
    this.publishTransaction = config.publishTransaction;
    this.approveTransaction = config.approveTransaction;
    this.confirmTransaction = config.confirmTransaction;
  }

  /**
    checks the network for signed txs and releases the nonce global lock if it is
  */
  async updatePendingTxs() {
    // in order to keep the nonceTracker accurate we block it while updating pending transactions
    const nonceGlobalLock = await this.nonceTracker.getGlobalLock();
    try {
      const pendingTxs = this.getPendingTransactions();
      await Promise.all(
        pendingTxs.map((txMeta) => this._checkPendingTx(txMeta)),
      );
    } catch (err) {
      log.error(
        'PendingTransactionTracker - Error updating pending transactions',
      );
      log.error(err);
    }
    nonceGlobalLock.releaseLock();
  }

  /**
   * Resubmits each pending transaction
   * @param {string} blockNumber - the latest block number in hex
   * @emits tx:warning
   * @returns {Promise<void>}
   */
  async resubmitPendingTxs(blockNumber) {
    const pending = this.getPendingTransactions();
    if (!pending.length) {
      return;
    }
    for (const txMeta of pending) {
      try {
        await this._resubmitTx(txMeta, blockNumber);
      } catch (err) {
        const errorMessage =
          err.value?.message?.toLowerCase() || err.message.toLowerCase();
        const isKnownTx =
          // geth
          errorMessage.includes('replacement transaction underpriced') ||
          errorMessage.includes('known transaction') ||
          // parity
          errorMessage.includes('gas price too low to replace') ||
          errorMessage.includes(
            'transaction with the same hash was already imported',
          ) ||
          // other
          errorMessage.includes('gateway timeout') ||
          errorMessage.includes('nonce too low');
        // ignore resubmit warnings, return early
        if (isKnownTx) {
          return;
        }
        // encountered real error - transition to error state
        txMeta.warning = {
          error: errorMessage,
          message: 'There was an error when resubmitting this transaction.',
        };
        this.emit('tx:warning', txMeta, err);
      }
    }
  }

  /**
   * Attempts to resubmit the given transaction with exponential backoff
   *
   * Will only attempt to retry the given tx every {@code 2**(txMeta.retryCount)} blocks.
   *
   * @param {Object} txMeta - the transaction metadata
   * @param {string} latestBlockNumber - the latest block number in hex
   * @returns {Promise<string|undefined>} the tx hash if retried
   * @emits tx:block-update
   * @emits tx:retry
   * @private
   */
  async _resubmitTx(txMeta, latestBlockNumber) {
    if (
      txMeta.metamaskNetworkId === THETAMAINNET_NETWORK_ID &&
      txMeta.txParams.isThetaNative
    ) {
      return undefined;
    }

    if (!txMeta.firstRetryBlockNumber) {
      this.emit('tx:block-update', txMeta, latestBlockNumber);
    }

    const firstRetryBlockNumber =
      txMeta.firstRetryBlockNumber || latestBlockNumber;
    const txBlockDistance =
      Number.parseInt(latestBlockNumber, 16) -
      Number.parseInt(firstRetryBlockNumber, 16);

    const retryCount = txMeta.retryCount || 0;

    // Exponential backoff to limit retries at publishing
    if (txBlockDistance <= Math.pow(2, retryCount) - 1) {
      return undefined;
    }

    // Only auto-submit already-signed txs:
    if (!('rawTx' in txMeta)) {
      return this.approveTransaction(txMeta.id);
    }

    const { rawTx } = txMeta;
    const txHash = await this.publishTransaction(rawTx);

    // Increment successful tries:
    this.emit('tx:retry', txMeta);
    return txHash;
  }

  /**
   * Query the network to see if the given {@code txMeta} has been included in a block
   * @param {Object} txMeta - the transaction metadata
   * @returns {Promise<void>}
   * @emits tx:confirmed
   * @emits tx:dropped
   * @emits tx:failed
   * @emits tx:warning
   * @private
   */
  async _checkPendingTx(txMeta) {
    const txHash = txMeta.hash;
    const txId = txMeta.id;

    // Only check submitted txs
    if (txMeta.status !== 'submitted') {
      return;
    }

    // extra check in case there was an uncaught error during the
    // signature and submission process
    if (!txHash) {
      const noTxHashErr = new Error(
        'We had an error while submitting this transaction, please try again.',
      );
      noTxHashErr.name = 'NoTxHashError';
      this.emit('tx:failed', txId, noTxHashErr);
      return;
    }

    if (await this._checkIfNonceIsTaken(txMeta)) {
      this.emit('tx:dropped', txId);
      return;
    }

    try {
      if (txMeta.txParams.isThetaNative) {
        // TODO: may want to move this requester and parser into transaction utils like isSmartContract
        const baseFeePerGas = hexToBn(THETA_GASPRICE_HEXWEI);
        const txInfo = await new Promise((resolve, reject) => {
          request(
            {
              url: THETAMAINNET_NATIVE_RPC_URL,
              method: 'post',
              json: true,
              headers: { 'Content-Type': 'application/json' },
              body: {
                jsonrpc: '2.0',
                method: 'theta.GetTransaction',
                params: [
                  {
                    hash: txHash,
                  },
                ],
                id: 1,
              },
            },
            (err, res, body) => {
              if (err) {
                log.error(
                  `ERROR fetching theta tx with hash ${txHash}: `,
                  JSON.stringify(err),
                );
                reject(err);
                return;
              }
              log.debug(res);
              log.debug(`statusCode: ${res.statusCode}`);
              if (res.statusCode === 200 && body.result) {
                resolve(body.result);
              } else {
                reject(JSON.stringify({ statusCode: res.statusCode, body }));
              }
            },
          );
        });
        if (
          txInfo.status === 'finalized' &&
          txInfo.type &&
          parseInt(txInfo.block_height, 10)
        ) {
          const transactionReceipt = {
            blockHash: txInfo.block_hash,
            blockNumber: txInfo.block_height,
            contractAddress: txInfo.receipt?.ContractAddress || undefined,
            // cumulativeGasUsed,
            from:
              txInfo.transaction?.from?.address ||
              txInfo.transaction?.inputs?.[0]?.address,
            effectiveGasPrice: `0x${baseFeePerGas.toString('hex')}`,
            gasUsed: txInfo.blance_changes?.GasUsed
              ? `0x${new BN(txInfo.blance_changes.GasUsed, 10).toString('hex')}`
              : `0x${new BN(txInfo.transaction?.fee?.tfuelwei, 10)
                .div(baseFeePerGas)
                .toString('hex')}`,
            logs: txInfo.receipt?.Logs,
            // logsBloom,
            // root,
            to:
              txInfo.transaction?.to?.address ||
              txInfo.transaction?.outputs?.[0]?.address,
            transactionHash: txInfo.hash || txInfo.receipt?.TxHash,
            transactionIndex:
              parseInt(
                txInfo.transaction?.from?.sequence ||
                txInfo.transaction?.inputs?.[0].sequence,
                10,
              ) - 1 || undefined,
            isThetaNative: true,
          };
          this.emit(
            'tx:confirmed',
            txId,
            transactionReceipt,
            `0x${baseFeePerGas.toString('hex')}`,
          );
          return;
        }
      } else {
        // not theta-native:
        const transactionReceipt = await this.query.getTransactionReceipt(
          txHash,
        );
        if (transactionReceipt?.blockNumber) {
          this.emit('tx:confirmed', txId, transactionReceipt);
          return;
        }
      }
    } catch (err) {
      txMeta.warning = {
        error: err.message,
        message: 'There was a problem loading this transaction.',
      };
      this.emit('tx:warning', txMeta, err);
      return;
    }

    if (await this._checkIfTxWasDropped(txMeta)) {
      this.emit('tx:dropped', txId);
    }
  }

  /**
   * Checks whether the nonce in the given {@code txMeta} is behind the network nonce
   *
   * @param {Object} txMeta - the transaction metadata
   * @returns {Promise<boolean>}
   * @private
   */
  async _checkIfTxWasDropped(txMeta) {
    const {
      hash: txHash,
      txParams: { nonce, from },
    } = txMeta;
    const networkNextNonce = await this.query.getTransactionCount(from);

    if (parseInt(nonce, 16) >= networkNextNonce.toNumber()) {
      return false;
    }

    if (!this.droppedBlocksBufferByHash.has(txHash)) {
      this.droppedBlocksBufferByHash.set(txHash, 0);
    }

    const currentBlockBuffer = this.droppedBlocksBufferByHash.get(txHash);

    if (currentBlockBuffer < this.DROPPED_BUFFER_COUNT) {
      this.droppedBlocksBufferByHash.set(txHash, currentBlockBuffer + 1);
      return false;
    }

    this.droppedBlocksBufferByHash.delete(txHash);
    return true;
  }

  /**
   * Checks whether the nonce in the given {@code txMeta} is correct against the local set of transactions
   * @param {Object} txMeta - the transaction metadata
   * @returns {Promise<boolean>}
   * @private
   */
  async _checkIfNonceIsTaken(txMeta) {
    const address = txMeta.txParams.from;
    const completed = this.getCompletedTransactions(address);
    return completed.some(
      // This is called while the transaction is in-flight, so it is possible that the
      // list of completed transactions now includes the transaction we were looking at
      // and if that is the case, don't consider the transaction to have taken its own nonce
      (other) =>
        !(other.id === txMeta.id) &&
        other.txParams.nonce === txMeta.txParams.nonce,
    );
  }
}
