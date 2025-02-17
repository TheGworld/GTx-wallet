import ethUtil from 'ethereumjs-util';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ENVIRONMENT_TYPE_NOTIFICATION } from '../../../app/scripts/lib/enums';
import { getEnvironmentType } from '../../../app/scripts/lib/util';
import ConfirmPageContainer, {
  ConfirmDetailRow,
} from '../../components/app/confirm-page-container';
import { isBalanceSufficient } from '../send/send.utils';
import { CONFIRM_TRANSACTION_ROUTE } from '../../helpers/constants/routes';
import {
  INSUFFICIENT_FUNDS_ERROR_KEY,
  TRANSACTION_ERROR_KEY,
  GAS_LIMIT_TOO_LOW_ERROR_KEY,
} from '../../helpers/constants/error-keys';
import {
  CONFIRMED_STATUS,
  DROPPED_STATUS,
} from '../../helpers/constants/transactions';
import UserPreferencedCurrencyDisplay from '../../components/app/user-preferenced-currency-display';
import { PRIMARY, SECONDARY } from '../../helpers/constants/common';
import { hexToDecimal } from '../../helpers/utils/conversions.util';
import AdvancedGasInputs from '../../components/app/gas-customization/advanced-gas-inputs';
import TextField from '../../components/ui/text-field';
import { conversionUtil } from '../../helpers/utils/conversion-util';
import {
  ETH_SYMBOL,
  MAINNET_NETWORK_ID,
  TFUEL_SYMBOL,
  THETAMAINNET_NETWORK_ID,
  THETA_SYMBOL,
} from '../../../app/scripts/controllers/network/enums';
import { getTransactionTypeTitle } from '../../helpers/utils/transactions.util';

export default class ConfirmTransactionBase extends Component {
  static contextTypes = {
    t: PropTypes.func,
  };

  static propTypes = {
    // react-router props
    history: PropTypes.object,
    // Redux props
    balance: PropTypes.string,
    cancelTransaction: PropTypes.func,
    cancelAllTransactions: PropTypes.func,
    clearConfirmTransaction: PropTypes.func,
    conversionRate: PropTypes.number,
    fromAddress: PropTypes.string,
    fromName: PropTypes.string,
    hexTransactionAmount: PropTypes.string,
    hexTransactionAmount2: PropTypes.string,
    hexTransactionFee: PropTypes.string,
    hexTransactionTotal: PropTypes.string,
    isTxReprice: PropTypes.bool,
    methodData: PropTypes.object,
    nonce: PropTypes.string,
    useNonceField: PropTypes.bool,
    customNonceValue: PropTypes.string,
    updateCustomNonce: PropTypes.func,
    assetImage: PropTypes.string,
    sendTransaction: PropTypes.func,
    showCustomizeGasModal: PropTypes.func,
    showTransactionConfirmedModal: PropTypes.func,
    showRejectTransactionsConfirmationModal: PropTypes.func,
    toAddress: PropTypes.string,
    tokenData: PropTypes.object,
    tokenProps: PropTypes.object,
    toName: PropTypes.string,
    toEns: PropTypes.string,
    toNickname: PropTypes.string,
    transactionStatus: PropTypes.string,
    txData: PropTypes.object,
    unapprovedTxCount: PropTypes.number,
    currentNetworkUnapprovedTxs: PropTypes.object,
    updateGasAndCalculate: PropTypes.func,
    customGas: PropTypes.object,
    // Component props
    actionKey: PropTypes.string,
    contentComponent: PropTypes.node,
    dataComponent: PropTypes.node,
    detailsComponent: PropTypes.node,
    errorKey: PropTypes.string,
    errorMessage: PropTypes.string,
    primaryTotalTextOverride: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.node,
    ]),
    secondaryTotalTextOverride: PropTypes.string,
    hideData: PropTypes.bool,
    hideDetails: PropTypes.bool,
    hideSubtitle: PropTypes.bool,
    identiconAddress: PropTypes.string,
    onCancel: PropTypes.func,
    onEdit: PropTypes.func,
    onEditGas: PropTypes.func,
    onSubmit: PropTypes.func,
    subtitle: PropTypes.string,
    subtitleComponent: PropTypes.node,
    summaryComponent: PropTypes.node,
    title: PropTypes.string,
    titleComponent: PropTypes.node,
    valid: PropTypes.bool,
    warning: PropTypes.string,
    advancedInlineGasShown: PropTypes.bool,
    insufficientBalance: PropTypes.bool,
    hideFiatConversion: PropTypes.bool,
    showFiatForGas: PropTypes.bool,
    type: PropTypes.string,
    getNextNonce: PropTypes.func,
    nextNonce: PropTypes.number,
    tryReverseResolveAddress: PropTypes.func.isRequired,
    hideSenderToRecipient: PropTypes.bool,
    showAccountInHeader: PropTypes.bool,
    mostRecentOverviewPage: PropTypes.string.isRequired,
    isMainnet: PropTypes.bool,
    action: PropTypes.string,
  };

  state = {
    submitting: false,
    submitError: null,
    submitWarning: '',
  };

  componentDidUpdate(prevProps) {
    const {
      transactionStatus,
      showTransactionConfirmedModal,
      history,
      clearConfirmTransaction,
      mostRecentOverviewPage,
      nextNonce,
      customNonceValue,
      toAddress,
      tryReverseResolveAddress,
    } = this.props;
    const {
      customNonceValue: prevCustomNonceValue,
      nextNonce: prevNextNonce,
      toAddress: prevToAddress,
      transactionStatus: prevTxStatus,
    } = prevProps;
    const statusUpdated = transactionStatus !== prevTxStatus;
    const txDroppedOrConfirmed =
      transactionStatus === DROPPED_STATUS ||
      transactionStatus === CONFIRMED_STATUS;

    if (
      nextNonce !== prevNextNonce ||
      customNonceValue !== prevCustomNonceValue
    ) {
      if (customNonceValue > nextNonce) {
        this.setState({
          submitWarning: this.context.t('nextNonceWarning', [nextNonce]),
        });
      } else {
        this.setState({ submitWarning: '' });
      }
    }

    if (statusUpdated && txDroppedOrConfirmed) {
      showTransactionConfirmedModal({
        onSubmit: () => {
          clearConfirmTransaction();
          history.push(mostRecentOverviewPage);
        },
      });
    }

    if (toAddress && toAddress !== prevToAddress) {
      tryReverseResolveAddress(toAddress);
    }
  }

  getErrorKey() {
    const {
      balance,
      conversionRate,
      hexTransactionFee,
      txData: { simulationFails, txParams: { value: amount } = {} } = {},
      customGas,
    } = this.props;

    const insufficientBalance =
      balance &&
      !isBalanceSufficient({
        amount,
        gasTotal: hexTransactionFee || '0x0',
        balance,
        conversionRate,
      });

    if (insufficientBalance) {
      return {
        valid: false,
        errorKey: INSUFFICIENT_FUNDS_ERROR_KEY,
      };
    }

    if (hexToDecimal(customGas.gasLimit) < 21000) {
      return {
        valid: false,
        errorKey: GAS_LIMIT_TOO_LOW_ERROR_KEY,
      };
    }

    if (simulationFails) {
      return {
        valid: true,
        errorKey: simulationFails.errorKey
          ? simulationFails.errorKey
          : TRANSACTION_ERROR_KEY,
      };
    }

    return {
      valid: true,
    };
  }

  handleEditGas() {
    const { onEditGas, showCustomizeGasModal } = this.props;

    if (onEditGas) {
      onEditGas();
    } else {
      showCustomizeGasModal();
    }
  }

  renderDetails() {
    const {
      detailsComponent,
      secondaryTotalTextOverride,
      hexTransactionFee,
      hexTransactionTotal,
      hideDetails,
      useNonceField,
      customNonceValue,
      updateCustomNonce,
      advancedInlineGasShown,
      customGas,
      insufficientBalance,
      updateGasAndCalculate,
      hideFiatConversion,
      showFiatForGas,
      nextNonce,
      getNextNonce,
      isMainnet,
      txData,
    } = this.props;
    let { primaryTotalTextOverride } = this.props;

    if (hideDetails) {
      return null;
    }

    const notMainnetOrTest = !(isMainnet || process.env.IN_TEST);

    const hasTheta = txData.txParams.value2 && txData.txParams.value2 !== '0x0';

    if (hasTheta) {
      const val = conversionUtil(txData.txParams.value2, {
        fromNumericBase: 'hex',
        toNumericBase: 'dec',
        fromDenomination: 'WEI',
        numberOfDecimals: 6,
      });
      const tot = conversionUtil(hexTransactionTotal, {
        fromNumericBase: 'hex',
        toNumericBase: 'dec',
        fromDenomination: 'WEI',
        numberOfDecimals: 6,
      });

      if (!primaryTotalTextOverride) {
        primaryTotalTextOverride = `${val} ${THETA_SYMBOL} + ${tot} ${TFUEL_SYMBOL}`;
      }
    }

    return (
      detailsComponent || (
        <div className="confirm-page-container-content__details">
          <div className="confirm-page-container-content__gas-fee">
            <ConfirmDetailRow
              label="Gas Fee"
              value={hexTransactionFee}
              headerText={notMainnetOrTest ? '' : 'Edit'}
              headerTextClassName={
                notMainnetOrTest ? '' : 'confirm-detail-row__header-text--edit'
              }
              onHeaderClick={
                typeof txData.txParams?.additional?.purpose !== 'undefined' ||
                notMainnetOrTest
                  ? undefined
                  : () => this.handleEditGas()
              }
              secondaryText={
                showFiatForGas
                  ? ''
                  : this.context.t('noConversionRateAvailable')
              }
            />
            {advancedInlineGasShown || notMainnetOrTest ? (
              <AdvancedGasInputs
                updateCustomGasPriceParams={(newGasPriceParams) =>
                  updateGasAndCalculate({ ...customGas, ...newGasPriceParams })
                }
                updateCustomGasLimit={(newGasLimit) =>
                  updateGasAndCalculate({ ...customGas, gasLimit: newGasLimit })
                }
                customGasPriceParams={customGas.gasPriceParams}
                customGasLimit={customGas.gasLimit}
                insufficientBalance={insufficientBalance}
                customPriceIsSafe
                isSpeedUp={false}
              />
            ) : null}
          </div>
          <div
            className={
              useNonceField ? 'confirm-page-container-content__gas-fee' : null
            }
          >
            <ConfirmDetailRow
              label="Total"
              value={hexTransactionTotal}
              primaryText={primaryTotalTextOverride}
              secondaryText={
                hideFiatConversion || hasTheta
                  ? this.context.t('noConversionRateAvailable')
                  : secondaryTotalTextOverride
              }
              headerText={this.context.t('amountPlusGasFee')}
              headerTextClassName="confirm-detail-row__header-text--total"
              primaryValueTextColor="#2f9ae0"
            />
          </div>
          {useNonceField ? (
            <div>
              <div className="confirm-detail-row">
                <div className="confirm-detail-row__label">
                  {this.context.t('nonceFieldHeading')}
                </div>
                <div className="custom-nonce-input">
                  <TextField
                    type="number"
                    min="0"
                    placeholder={
                      typeof nextNonce === 'number'
                        ? nextNonce.toString()
                        : null
                    }
                    onChange={({ target: { value } }) => {
                      if (!value.length || Number(value) < 0) {
                        updateCustomNonce('');
                      } else {
                        updateCustomNonce(String(Math.floor(value)));
                      }
                      getNextNonce();
                    }}
                    fullWidth
                    margin="dense"
                    value={customNonceValue || ''}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )
    );
  }

  renderData(functionType) {
    const { t } = this.context;
    const {
      txData: { txParams: { data } = {} } = {},
      methodData: { params } = {},
      hideData,
      dataComponent,
    } = this.props;

    if (hideData) {
      return null;
    }

    return (
      dataComponent || (
        <div className="confirm-page-container-content__data">
          <div className="confirm-page-container-content__data-box-label">
            {`${t('functionType')}:`}
            <span className="confirm-page-container-content__function-type">
              {functionType}
            </span>
          </div>
          {params && (
            <div className="confirm-page-container-content__data-box">
              <div className="confirm-page-container-content__data-field-label">
                {`${t('parameters')}:`}
              </div>
              <div>
                <pre>{JSON.stringify(params, null, 2)}</pre>
              </div>
            </div>
          )}
          <div className="confirm-page-container-content__data-box-label">
            {`${t('hexData')}: ${ethUtil.toBuffer(data).length} bytes`}
          </div>
          <div className="confirm-page-container-content__data-box">{data}</div>
        </div>
      )
    );
  }

  handleEdit() {
    const { txData, tokenData, tokenProps, onEdit } = this.props;
    onEdit({ txData, tokenData, tokenProps });
  }

  handleCancelAll() {
    const {
      cancelAllTransactions,
      clearConfirmTransaction,
      history,
      mostRecentOverviewPage,
      showRejectTransactionsConfirmationModal,
      unapprovedTxCount,
    } = this.props;

    showRejectTransactionsConfirmationModal({
      unapprovedTxCount,
      onSubmit: async () => {
        this._removeBeforeUnload();
        await cancelAllTransactions();
        clearConfirmTransaction();
        history.push(mostRecentOverviewPage);
      },
    });
  }

  handleCancel() {
    const {
      onCancel,
      txData,
      cancelTransaction,
      history,
      mostRecentOverviewPage,
      clearConfirmTransaction,
      updateCustomNonce,
    } = this.props;

    this._removeBeforeUnload();
    updateCustomNonce('');
    if (onCancel) {
      onCancel(txData);
    } else {
      cancelTransaction(txData).then(() => {
        clearConfirmTransaction();
        history.push(mostRecentOverviewPage);
      });
    }
  }

  handleSubmit() {
    const {
      sendTransaction,
      clearConfirmTransaction,
      txData,
      history,
      onSubmit,
      mostRecentOverviewPage,
      updateCustomNonce,
    } = this.props;
    const { submitting } = this.state;

    if (submitting) {
      return;
    }

    this.setState(
      {
        submitting: true,
        submitError: null,
      },
      () => {
        this._removeBeforeUnload();
        if (onSubmit) {
          Promise.resolve(onSubmit(txData)).then(() => {
            this.setState({
              submitting: false,
            });
            updateCustomNonce('');
          });
        } else {
          sendTransaction(txData)
            .then(() => {
              clearConfirmTransaction();
              this.setState(
                {
                  submitting: false,
                },
                () => {
                  history.push(mostRecentOverviewPage);
                  updateCustomNonce('');
                },
              );
            })
            .catch((error) => {
              this.setState({
                submitting: false,
                submitError: error.message,
              });
              updateCustomNonce('');
            });
        }
      },
    );
  }

  renderTitleComponent() {
    const {
      title,
      titleComponent,
      hexTransactionAmount,
      hexTransactionAmount2,
      txData,
    } = this.props;

    // Title string passed in by props takes priority
    if (title) {
      return null;
    }

    let suffix;
    if (txData.txParams.value2) {
      suffix = THETA_SYMBOL;
    } else if (txData.metamaskNetworkId === THETAMAINNET_NETWORK_ID) {
      suffix = TFUEL_SYMBOL;
    } else {
      suffix =
        txData.metamaskNetworkId === MAINNET_NETWORK_ID
          ? ETH_SYMBOL
          : undefined;
    }

    const isNative2 = txData.txParams.value2 ? true : undefined;

    return (
      titleComponent || (
        <UserPreferencedCurrencyDisplay
          value={hexTransactionAmount2 || hexTransactionAmount}
          type={PRIMARY}
          showEthLogo
          ethLogoHeight="26"
          hideLabel
          suffix={suffix}
          isNative2={isNative2}
        />
      )
    );
  }

  renderSubtitleComponent() {
    const {
      subtitle,
      subtitleComponent,
      hexTransactionAmount,
      hexTransactionAmount2,
    } = this.props;

    // Subtitle string passed in by props takes priority
    if (subtitle) {
      return null;
    }

    if (hexTransactionAmount2) {
      return <span>{this.context.t('noConversionRateAvailable')}</span>; // TODO: add theta conversion to USD
    }

    return (
      subtitleComponent || (
        <UserPreferencedCurrencyDisplay
          value={hexTransactionAmount2 || hexTransactionAmount}
          type={SECONDARY}
          showEthLogo
          hideLabel
        />
      )
    );
  }

  handleNextTx(txId) {
    const { history, clearConfirmTransaction } = this.props;

    if (txId) {
      clearConfirmTransaction();
      history.push(`${CONFIRM_TRANSACTION_ROUTE}/${txId}`);
    }
  }

  getNavigateTxData() {
    const { currentNetworkUnapprovedTxs, txData: { id } = {} } = this.props;
    const enumUnapprovedTxs = Object.keys(currentNetworkUnapprovedTxs);
    const currentPosition = enumUnapprovedTxs.indexOf(id ? id.toString() : '');

    return {
      totalTx: enumUnapprovedTxs.length,
      positionOfCurrentTx: currentPosition + 1,
      nextTxId: enumUnapprovedTxs[currentPosition + 1],
      prevTxId: enumUnapprovedTxs[currentPosition - 1],
      showNavigation: enumUnapprovedTxs.length > 1,
      firstTx: enumUnapprovedTxs[0],
      lastTx: enumUnapprovedTxs[enumUnapprovedTxs.length - 1],
      ofText: this.context.t('ofTextNofM'),
      requestsWaitingText: this.context.t('requestsAwaitingAcknowledgement'),
    };
  }

  _beforeUnload = () => {
    const { txData: { id } = {}, cancelTransaction } = this.props;
    cancelTransaction({ id });
  };

  _removeBeforeUnload = () => {
    if (getEnvironmentType() === ENVIRONMENT_TYPE_NOTIFICATION) {
      window.removeEventListener('beforeunload', this._beforeUnload);
    }
  };

  componentDidMount() {
    const { toAddress, getNextNonce, tryReverseResolveAddress } = this.props;

    if (getEnvironmentType() === ENVIRONMENT_TYPE_NOTIFICATION) {
      window.addEventListener('beforeunload', this._beforeUnload);
    }

    getNextNonce();
    if (toAddress) {
      tryReverseResolveAddress(toAddress);
    }
  }

  componentWillUnmount() {
    this._removeBeforeUnload();
  }

  render() {
    const { t } = this.context;
    const {
      isTxReprice,
      fromName,
      fromAddress,
      toName,
      toAddress,
      toEns,
      toNickname,
      methodData,
      valid: propsValid = true,
      errorMessage,
      errorKey: propsErrorKey,
      title,
      subtitle,
      hideSubtitle,
      identiconAddress,
      summaryComponent,
      contentComponent,
      onEdit,
      nonce,
      customNonceValue,
      assetImage,
      warning,
      unapprovedTxCount,
      type,
      hideSenderToRecipient,
      showAccountInHeader,
      txData,
      action,
    } = this.props;
    const { submitting, submitError, submitWarning } = this.state;

    const { name } = methodData;
    const { valid, errorKey } = this.getErrorKey();
    const {
      totalTx,
      positionOfCurrentTx,
      nextTxId,
      prevTxId,
      showNavigation,
      firstTx,
      lastTx,
      ofText,
      requestsWaitingText,
    } = this.getNavigateTxData();

    const typeEx = type ?? txData.type;

    let functionType = getMethodName(name);
    let actionLabel;
    if (!functionType || !functionType.length) {
      if (typeEx) {
        functionType = getTransactionTypeTitle(t, typeEx);
        actionLabel = getTransactionTypeTitle(
          t,
          typeEx,
          txData.txParams?.additional,
        );
      } else {
        functionType = t('contractInteraction');
      }
    }

    return (
      <ConfirmPageContainer
        fromName={fromName}
        fromAddress={fromAddress}
        showAccountInHeader={showAccountInHeader}
        toName={toName}
        toAddress={toAddress}
        toEns={toEns}
        toNickname={toNickname}
        showEdit={onEdit && !isTxReprice}
        action={action || functionType}
        actionLabel={actionLabel}
        title={title}
        titleComponent={this.renderTitleComponent()}
        subtitle={subtitle}
        subtitleComponent={this.renderSubtitleComponent()}
        hideSubtitle={hideSubtitle}
        summaryComponent={summaryComponent}
        detailsComponent={this.renderDetails()}
        dataComponent={this.renderData(functionType)}
        contentComponent={contentComponent}
        nonce={customNonceValue || nonce}
        unapprovedTxCount={unapprovedTxCount}
        assetImage={assetImage}
        identiconAddress={identiconAddress}
        errorMessage={errorMessage || submitError}
        errorKey={propsErrorKey || errorKey}
        warning={warning || submitWarning}
        totalTx={totalTx}
        positionOfCurrentTx={positionOfCurrentTx}
        nextTxId={nextTxId}
        prevTxId={prevTxId}
        showNavigation={showNavigation}
        onNextTx={(txId) => this.handleNextTx(txId)}
        firstTx={firstTx}
        lastTx={lastTx}
        ofText={ofText}
        requestsWaitingText={requestsWaitingText}
        disabled={!propsValid || !valid || submitting}
        onEdit={() => this.handleEdit()}
        onCancelAll={() => this.handleCancelAll()}
        onCancel={() => this.handleCancel()}
        onSubmit={() => this.handleSubmit()}
        hideSenderToRecipient={hideSenderToRecipient}
      />
    );
  }
}

export function getMethodName(camelCase) {
  if (!camelCase || typeof camelCase !== 'string') {
    return '';
  }

  return camelCase
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/([A-Z])([a-z])/gu, ' $1$2')
    .replace(/ +/gu, ' ');
}
