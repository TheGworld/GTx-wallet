import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Switch, Route } from 'react-router-dom';
import { ASSET_MODE } from '../../../shared/constants/transaction';
import Loading from '../../components/ui/loading-screen';
import ConfirmTransactionSwitch from '../confirm-transaction-switch';
import ConfirmTransactionBase from '../confirm-transaction-base';
import ConfirmSendEther from '../confirm-send-ether';
import ConfirmSendToken from '../confirm-send-token';
import ConfirmWrapToken from '../confirm-wrap-token';
import ConfirmStakeUnstake from '../confirm-stake-unstake';
import ConfirmDeployContract from '../confirm-deploy-contract';
import ConfirmApprove from '../confirm-approve';
import ConfirmTokenTransactionBaseContainer from '../confirm-token-transaction-base';
import ConfirmDecryptMessage from '../confirm-decrypt-message';
import ConfirmEncryptionPublicKey from '../confirm-encryption-public-key';

import {
  CONFIRM_TRANSACTION_ROUTE,
  CONFIRM_DEPLOY_CONTRACT_PATH,
  CONFIRM_SEND_ETHER_PATH,
  CONFIRM_SEND_TOKEN_PATH,
  CONFIRM_WRAP_TOKEN_PATH,
  CONFIRM_STAKE_PATH,
  CONFIRM_UNSTAKE_PATH,
  CONFIRM_APPROVE_PATH,
  CONFIRM_TRANSFER_FROM_PATH,
  CONFIRM_TOKEN_METHOD_PATH,
  SIGNATURE_REQUEST_PATH,
  DECRYPT_MESSAGE_REQUEST_PATH,
  ENCRYPTION_PUBLIC_KEY_REQUEST_PATH,
} from '../../helpers/constants/routes';
import ConfTx from './conf-tx';

export default class ConfirmTransaction extends Component {
  static propTypes = {
    history: PropTypes.object.isRequired,
    totalUnapprovedCount: PropTypes.number.isRequired,
    send: PropTypes.object,
    setTransactionToConfirm: PropTypes.func,
    clearConfirmTransaction: PropTypes.func,
    fetchBasicGasEstimates: PropTypes.func,
    mostRecentOverviewPage: PropTypes.string.isRequired,
    transaction: PropTypes.object,
    getContractMethodData: PropTypes.func,
    transactionId: PropTypes.string,
    paramsTransactionId: PropTypes.string,
    getTokenParams: PropTypes.func,
    isTokenMethodAction: PropTypes.bool,
  };

  componentDidMount() {
    const {
      totalUnapprovedCount = 0,
      send = {},
      history,
      mostRecentOverviewPage,
      transaction: { txParams: { data, to } = {} } = {},
      fetchBasicGasEstimates,
      getContractMethodData,
      transactionId,
      paramsTransactionId,
      getTokenParams,
      isTokenMethodAction,
    } = this.props;

    if (
      !totalUnapprovedCount &&
      !send.to &&
      (!send.asset || send.asset.mode === ASSET_MODE.SEND)
    ) {
      history.replace(mostRecentOverviewPage);
      return;
    }

    fetchBasicGasEstimates();
    getContractMethodData(data);
    if (isTokenMethodAction) {
      getTokenParams(to);
    }
    const txId = transactionId || paramsTransactionId;
    if (txId) {
      this.props.setTransactionToConfirm(txId);
    }
  }

  componentDidUpdate(prevProps) {
    const {
      setTransactionToConfirm,
      transaction: { txData: { txParams: { data } = {} } = {} },
      clearConfirmTransaction,
      getContractMethodData,
      paramsTransactionId,
      transactionId,
      history,
      mostRecentOverviewPage,
      totalUnapprovedCount,
    } = this.props;

    if (
      paramsTransactionId &&
      transactionId &&
      prevProps.paramsTransactionId !== paramsTransactionId
    ) {
      clearConfirmTransaction();
      getContractMethodData(data);
      setTransactionToConfirm(paramsTransactionId);
    } else if (
      prevProps.transactionId &&
      !transactionId &&
      !totalUnapprovedCount
    ) {
      history.replace(mostRecentOverviewPage);
    } else if (
      prevProps.transactionId &&
      transactionId &&
      prevProps.transactionId !== transactionId
    ) {
      history.replace(mostRecentOverviewPage);
    }
  }

  render() {
    const { transactionId, paramsTransactionId } = this.props;
    // Show routes when state.confirmTransaction has been set and when either the ID in the params
    // isn't specified or is specified and matches the ID in state.confirmTransaction in order to
    // support URLs of /confirm-transaction or /confirm-transaction/<transactionId>
    return transactionId &&
      (!paramsTransactionId || paramsTransactionId === transactionId) ? (
      <Switch>
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_DEPLOY_CONTRACT_PATH}`}
          component={ConfirmDeployContract}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_TOKEN_METHOD_PATH}`}
          component={ConfirmTransactionBase}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_SEND_ETHER_PATH}`}
          component={ConfirmSendEther}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_SEND_TOKEN_PATH}`}
          component={ConfirmSendToken}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_WRAP_TOKEN_PATH}`}
          component={ConfirmWrapToken}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_STAKE_PATH}`}
          component={ConfirmStakeUnstake}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_UNSTAKE_PATH}`}
          component={ConfirmStakeUnstake}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_APPROVE_PATH}`}
          component={ConfirmApprove}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${CONFIRM_TRANSFER_FROM_PATH}`}
          component={ConfirmTokenTransactionBaseContainer}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${SIGNATURE_REQUEST_PATH}`}
          component={ConfTx}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${DECRYPT_MESSAGE_REQUEST_PATH}`}
          component={ConfirmDecryptMessage}
        />
        <Route
          exact
          path={`${CONFIRM_TRANSACTION_ROUTE}/:id?${ENCRYPTION_PUBLIC_KEY_REQUEST_PATH}`}
          component={ConfirmEncryptionPublicKey}
        />
        <Route path="*" component={ConfirmTransactionSwitch} />
      </Switch>
    ) : (
      <Loading />
    );
  }
}
