import { addHexPrefix } from 'ethereumjs-util';
import {
  conversionRateSelector,
  currentCurrencySelector,
  unconfirmedTransactionsHashSelector,
  getNativeCurrency,
} from '../../selectors';

import {
  getValueFromWeiHex,
  getTransactionFee,
  getHexGasTotal,
  addFiat,
  addEth,
  increaseLastGasPrice,
  hexGreaterThan,
} from '../../helpers/utils/confirm-tx.util';

import { getTokenData, sumHexes } from '../../helpers/utils/transactions.util';

import { conversionUtil } from '../../helpers/utils/conversion-util';
import { getTokens } from '../metamask/metamask';

// Actions
const createActionType = (action) => `metamask/confirm-transaction/${action}`;

const UPDATE_TX_DATA = createActionType('UPDATE_TX_DATA');
const CLEAR_TX_DATA = createActionType('CLEAR_TX_DATA');
const UPDATE_TOKEN_DATA = createActionType('UPDATE_TOKEN_DATA');
const CLEAR_TOKEN_DATA = createActionType('CLEAR_TOKEN_DATA');
const UPDATE_METHOD_DATA = createActionType('UPDATE_METHOD_DATA');
const CLEAR_METHOD_DATA = createActionType('CLEAR_METHOD_DATA');
const CLEAR_CONFIRM_TRANSACTION = createActionType('CLEAR_CONFIRM_TRANSACTION');
const UPDATE_TRANSACTION_AMOUNTS = createActionType(
  'UPDATE_TRANSACTION_AMOUNTS',
);
const UPDATE_TRANSACTION_FEES = createActionType('UPDATE_TRANSACTION_FEES');
const UPDATE_TRANSACTION_TOTALS = createActionType('UPDATE_TRANSACTION_TOTALS');
const UPDATE_TOKEN_PROPS = createActionType('UPDATE_TOKEN_PROPS');
const UPDATE_NONCE = createActionType('UPDATE_NONCE');
const UPDATE_TO_SMART_CONTRACT = createActionType('UPDATE_TO_SMART_CONTRACT');
const FETCH_DATA_START = createActionType('FETCH_DATA_START');
const FETCH_DATA_END = createActionType('FETCH_DATA_END');

// Initial state
const initState = {
  txData: {},
  tokenData: {},
  methodData: {},
  tokenProps: {
    decimals: '',
    symbol: '',
  },
  fiatTransactionAmount: '',
  fiatTransactionFee: '',
  fiatTransactionTotal: '',
  ethTransactionAmount: '',
  ethTransactionFee: '',
  ethTransactionTotal: '',
  hexTransactionAmount: '',
  hexTransactionFee: '',
  hexTransactionTotal: '',
  nonce: '',
  toSmartContract: false,
  fetchingData: false,
};

// Reducer
export default function reducer(state = initState, action = {}) {
  switch (action.type) {
    case UPDATE_TX_DATA:
      return {
        ...state,
        txData: {
          ...action.payload,
        },
      };
    case CLEAR_TX_DATA:
      return {
        ...state,
        txData: {},
      };
    case UPDATE_TOKEN_DATA:
      return {
        ...state,
        tokenData: {
          ...action.payload,
        },
      };
    case CLEAR_TOKEN_DATA:
      return {
        ...state,
        tokenData: {},
      };
    case UPDATE_METHOD_DATA:
      return {
        ...state,
        methodData: {
          ...action.payload,
        },
      };
    case CLEAR_METHOD_DATA:
      return {
        ...state,
        methodData: {},
      };
    case UPDATE_TRANSACTION_AMOUNTS: {
      const {
        fiatTransactionAmount,
        ethTransactionAmount,
        hexTransactionAmount,
      } = action.payload;
      return {
        ...state,
        fiatTransactionAmount:
          fiatTransactionAmount || state.fiatTransactionAmount,
        ethTransactionAmount:
          ethTransactionAmount || state.ethTransactionAmount,
        hexTransactionAmount:
          hexTransactionAmount || state.hexTransactionAmount,
      };
    }
    case UPDATE_TRANSACTION_FEES: {
      const { fiatTransactionFee, ethTransactionFee, hexTransactionFee } =
        action.payload;
      return {
        ...state,
        fiatTransactionFee: fiatTransactionFee || state.fiatTransactionFee,
        ethTransactionFee: ethTransactionFee || state.ethTransactionFee,
        hexTransactionFee: hexTransactionFee || state.hexTransactionFee,
      };
    }
    case UPDATE_TRANSACTION_TOTALS: {
      const { fiatTransactionTotal, ethTransactionTotal, hexTransactionTotal } =
        action.payload;
      return {
        ...state,
        fiatTransactionTotal:
          fiatTransactionTotal || state.fiatTransactionTotal,
        ethTransactionTotal: ethTransactionTotal || state.ethTransactionTotal,
        hexTransactionTotal: hexTransactionTotal || state.hexTransactionTotal,
      };
    }
    case UPDATE_TOKEN_PROPS: {
      const { symbol = '', decimals = '' } = action.payload;
      return {
        ...state,
        tokenProps: {
          ...state.tokenProps,
          symbol,
          decimals,
        },
      };
    }
    case UPDATE_NONCE:
      return {
        ...state,
        nonce: action.payload,
      };
    case UPDATE_TO_SMART_CONTRACT:
      return {
        ...state,
        toSmartContract: action.payload,
      };
    case FETCH_DATA_START:
      return {
        ...state,
        fetchingData: true,
      };
    case FETCH_DATA_END:
      return {
        ...state,
        fetchingData: false,
      };
    case CLEAR_CONFIRM_TRANSACTION:
      return initState;
    default:
      return state;
  }
}

// Action Creators
export function updateTxData(txData) {
  return {
    type: UPDATE_TX_DATA,
    payload: txData,
  };
}

export function clearTxData() {
  return {
    type: CLEAR_TX_DATA,
  };
}

export function updateTokenData(tokenData) {
  return {
    type: UPDATE_TOKEN_DATA,
    payload: tokenData,
  };
}

export function clearTokenData() {
  return {
    type: CLEAR_TOKEN_DATA,
  };
}

export function updateMethodData(methodData) {
  return {
    type: UPDATE_METHOD_DATA,
    payload: methodData,
  };
}

export function clearMethodData() {
  return {
    type: CLEAR_METHOD_DATA,
  };
}

export function updateTransactionAmounts(amounts) {
  return {
    type: UPDATE_TRANSACTION_AMOUNTS,
    payload: amounts,
  };
}

export function updateTransactionFees(fees) {
  return {
    type: UPDATE_TRANSACTION_FEES,
    payload: fees,
  };
}

export function updateTransactionTotals(totals) {
  return {
    type: UPDATE_TRANSACTION_TOTALS,
    payload: totals,
  };
}

export function updateTokenProps(tokenProps) {
  return {
    type: UPDATE_TOKEN_PROPS,
    payload: tokenProps,
  };
}

export function updateNonce(nonce) {
  return {
    type: UPDATE_NONCE,
    payload: nonce,
  };
}

export function updateToSmartContract(toSmartContract) {
  return {
    type: UPDATE_TO_SMART_CONTRACT,
    payload: toSmartContract,
  };
}

export function setFetchingData(isFetching) {
  return {
    type: isFetching ? FETCH_DATA_START : FETCH_DATA_END,
  };
}

export function updateGasAndCalculate({ gasLimit, gasPriceParams }) {
  return (dispatch, getState) => {
    const {
      confirmTransaction: { txData },
    } = getState();
    const useGasPriceParams = {
      ...(gasPriceParams.maxFeePerGas && {
        maxFeePerGas: addHexPrefix(gasPriceParams.maxFeePerGas),
        maxPriorityFeePerGas: addHexPrefix(gasPriceParams.maxPriorityFeePerGas),
      }),
      ...(!gasPriceParams.maxFeePerGas && {
        gasPrice: addHexPrefix(gasPriceParams.gasPrice),
      }),
    };
    const newTxData = {
      ...txData,
      txParams: {
        ...txData.txParams,
        gas: addHexPrefix(gasLimit),
        ...useGasPriceParams,
      },
    };

    dispatch(updateTxDataAndCalculate(newTxData));
  };
}

function increaseFromLastGasPrice(txData) {
  const {
    lastGasPriceParams,
    txParams: {
      gasPrice: previousGasPrice,
      maxFeePerGas: previousMaxFeePerGas,
      maxPriorityFeePerGas: previousMaxPriorityFeePerGas,
    } = {},
  } = txData;

  // Set the minimum to a 10% increase from the last
  const gasPriceParams = {};
  if (previousMaxFeePerGas) {
    const minimumFeePerGas = increaseLastGasPrice(
      lastGasPriceParams?.maxFeePerGas,
    );
    const feeBelowMinimum = hexGreaterThan(
      minimumFeePerGas,
      previousMaxFeePerGas,
    );
    gasPriceParams.maxFeePerGas =
      !previousMaxFeePerGas || feeBelowMinimum
        ? minimumFeePerGas
        : previousMaxFeePerGas;

    const minimumPriorityFee = increaseLastGasPrice(
      lastGasPriceParams?.maxPriorityFeePerGas,
    );
    const priorityFeeBelowMinimum = hexGreaterThan(
      minimumPriorityFee,
      previousMaxPriorityFeePerGas,
    );
    gasPriceParams.maxPriorityFeePerGas =
      !previousMaxPriorityFeePerGas || priorityFeeBelowMinimum
        ? minimumPriorityFee
        : previousMaxPriorityFeePerGas;
  } else {
    const minimumGasPrice = increaseLastGasPrice(lastGasPriceParams?.gasPrice);
    const gasPriceBelowMinimum = hexGreaterThan(
      minimumGasPrice,
      previousGasPrice,
    );
    gasPriceParams.gasPrice =
      !previousGasPrice || gasPriceBelowMinimum
        ? minimumGasPrice
        : previousGasPrice;
  }

  return {
    ...txData,
    txParams: {
      ...txData.txParams,
      ...gasPriceParams,
    },
  };
}

export function updateTxDataAndCalculate(txData) {
  return (dispatch, getState) => {
    const state = getState();
    const currentCurrency = currentCurrencySelector(state);
    const conversionRate = conversionRateSelector(state);
    const nativeCurrency = getNativeCurrency(state);

    dispatch(updateTxData(txData));

    const {
      txParams: {
        value = '0x0',
        gas: gasLimit = '0x0',
        gasPrice = '0x0',
        maxFeePerGas,
      } = {},
    } = txData;

    const fiatTransactionAmount = getValueFromWeiHex({
      value,
      fromCurrency: nativeCurrency,
      toCurrency: currentCurrency,
      conversionRate,
      numberOfDecimals: 2,
    });
    const ethTransactionAmount = getValueFromWeiHex({
      value,
      fromCurrency: nativeCurrency,
      toCurrency: nativeCurrency,
      conversionRate,
      numberOfDecimals: 6,
    });

    dispatch(
      updateTransactionAmounts({
        fiatTransactionAmount,
        ethTransactionAmount,
        hexTransactionAmount: value,
      }),
    );

    const hexTransactionFee = getHexGasTotal({
      gasLimit,
      gasPrice: maxFeePerGas || gasPrice,
    });

    const fiatTransactionFee = getTransactionFee({
      value: hexTransactionFee,
      fromCurrency: nativeCurrency,
      toCurrency: currentCurrency,
      numberOfDecimals: 2,
      conversionRate,
    });
    const ethTransactionFee = getTransactionFee({
      value: hexTransactionFee,
      fromCurrency: nativeCurrency,
      toCurrency: nativeCurrency,
      numberOfDecimals: 6,
      conversionRate,
    });

    dispatch(
      updateTransactionFees({
        fiatTransactionFee,
        ethTransactionFee,
        hexTransactionFee,
      }),
    );

    const fiatTransactionTotal = addFiat(
      fiatTransactionFee,
      fiatTransactionAmount,
    );
    const ethTransactionTotal = addEth(ethTransactionFee, ethTransactionAmount);
    const hexTransactionTotal = sumHexes(value, hexTransactionFee);

    dispatch(
      updateTransactionTotals({
        fiatTransactionTotal,
        ethTransactionTotal,
        hexTransactionTotal,
      }),
    );
  };
}

export function setTransactionToConfirm(transactionId) {
  return (dispatch, getState) => {
    const state = getState();
    const unconfirmedTransactionsHash =
      unconfirmedTransactionsHashSelector(state);
    const transaction = unconfirmedTransactionsHash[transactionId];

    if (!transaction) {
      console.error(`Transaction with id ${transactionId} not found`);
      return;
    }

    if (transaction.txParams) {
      const { lastGasPriceParams } = transaction;
      const txData = lastGasPriceParams
        ? increaseFromLastGasPrice(transaction)
        : transaction;
      dispatch(updateTxDataAndCalculate(txData));

      const { txParams } = transaction;

      if (txParams.data) {
        const { data } = txParams;
        const tokenData = getTokenData(data);
        dispatch(updateTokenData(tokenData));
        const tokens = getTokens(state);
        const { symbol, decimals } =
          tokens?.find(({ address }) => address === txParams.to) ?? {};
        dispatch(updateTokenProps({ symbol, decimals }));
      }

      if (txParams.nonce) {
        const nonce = conversionUtil(txParams.nonce, {
          fromNumericBase: 'hex',
          toNumericBase: 'dec',
        });

        dispatch(updateNonce(nonce));
      }
    } else {
      dispatch(updateTxData(transaction));
    }
  };
}

export function clearConfirmTransaction() {
  return {
    type: CLEAR_CONFIRM_TRANSACTION,
  };
}
