import { stripHexPrefix, addHexPrefix } from 'ethereumjs-util';
import { createSelector } from 'reselect';
import { NETWORK_TYPES } from '../helpers/constants/common';
import {
  shortenAddress,
  checksumAddress,
  getAccountByAddress,
} from '../helpers/utils/util';
import {
  NETWORK_TYPE_TO_ID_MAP,
  THETAMAINNET_CHAIN_ID,
  THETAMAINNET_NETWORK_ID,
} from '../../app/scripts/controllers/network/enums';
import { baseFeeMultiplier } from '../../app/scripts/controllers/gas/gasPricingTracker';
import { decGWEIToHexWEI } from '../helpers/utils/conversions.util';
import { getPermissionsRequestCount } from './permissions';
import { getConversionRate } from './send';

export function getNetworkIdentifier(state) {
  const {
    metamask: {
      provider: { type, nickname, rpcTarget },
    },
  } = state;

  return nickname || rpcTarget || type;
}

export function getCurrentChainId(state) {
  const networkId = parseInt(state.metamask.network, 10);
  return networkId ? addHexPrefix(networkId.toString(16)) : undefined;
}

export function getCurrentKeyring(state) {
  const identity = getSelectedIdentity(state);

  if (!identity) {
    return null;
  }

  const simpleAddress = stripHexPrefix(identity.address).toLowerCase();

  const keyring = state.metamask.keyrings.find((kr) => {
    return (
      kr.accounts.includes(simpleAddress) ||
      kr.accounts.includes(identity.address)
    );
  });

  return keyring;
}

export function getAccountType(state) {
  const currentKeyring = getCurrentKeyring(state);
  const type = currentKeyring && currentKeyring.type;

  switch (type) {
    case 'Trezor Hardware':
    case 'Ledger Hardware':
      return 'hardware';
    case 'Simple Key Pair':
      return 'imported';
    default:
      return 'default';
  }
}

export function getCurrentNetworkId(state) {
  return state.metamask.network;
}

export const getMetaMaskAccounts = createSelector(
  getMetaMaskAccountsRaw,
  getMetaMaskCachedBalances,
  (currentAccounts, cachedBalances) =>
    Object.entries(currentAccounts).reduce(
      (selectedAccounts, [accountID, account]) => {
        if (account.balance === null || account.balance === undefined) {
          return {
            ...selectedAccounts,
            [accountID]: {
              ...account,
              balance: cachedBalances && cachedBalances[accountID],
            },
          };
        }
        return {
          ...selectedAccounts,
          [accountID]: account,
        };
      },
      {},
    ),
);

export function getSelectedAddress(state) {
  return state.metamask.selectedAddress;
}

export function getSelectedNFT(state) {
  return state.metamask.selectedNFT;
}

export function getSelectedIdentity(state) {
  const selectedAddress = getSelectedAddress(state);
  const { identities } = state.metamask;

  return identities[selectedAddress];
}

export function getNumberOfAccounts(state) {
  return Object.keys(state.metamask.accounts).length;
}

export function getNumberOfTokens(state) {
  const { tokens } = state.metamask;
  return tokens ? tokens.length : 0;
}

export function getMetaMaskKeyrings(state) {
  return state.metamask.keyrings;
}

export function getMetaMaskIdentities(state) {
  return state.metamask.identities;
}

export function getMetaMaskAccountsRaw(state) {
  return state.metamask.accounts;
}

export function getMetaMaskCachedBalances(state) {
  const network = getCurrentNetworkId(state);

  return state.metamask.cachedBalances[network];
}

/**
 * Get ordered (by keyrings) accounts with identity and balance
 */
export const getMetaMaskAccountsOrdered = createSelector(
  getMetaMaskKeyrings,
  getMetaMaskIdentities,
  getMetaMaskAccounts,
  (keyrings, identities, accounts) =>
    keyrings
      .reduce((list, keyring) => list.concat(keyring.accounts), [])
      .filter((address) => Boolean(identities[address]))
      .map((address) => ({ ...identities[address], ...accounts[address] })),
);

export function isBalanceCached(state) {
  const selectedAccountBalance =
    state.metamask.accounts[getSelectedAddress(state)].balance;
  const cachedBalance = getSelectedAccountCachedBalance(state);

  return Boolean(!selectedAccountBalance && cachedBalance);
}

export function getSelectedAccountCachedBalance(state) {
  const cachedBalances = state.metamask.cachedBalances[state.metamask.network];
  const selectedAddress = getSelectedAddress(state);

  return cachedBalances && cachedBalances[selectedAddress];
}

export function getSelectedAccount(state) {
  const accounts = getMetaMaskAccounts(state);
  const selectedAddress = getSelectedAddress(state);

  return accounts[selectedAddress];
}

export function getTargetAccount(state, targetAddress) {
  const accounts = getMetaMaskAccounts(state);
  return accounts[targetAddress];
}

export const getTokenExchangeRates = (state) =>
  state.metamask.contractExchangeRates;

export function getAssetImages(state) {
  const assetImages = state.metamask.assetImages || {};
  return assetImages;
}

export function getAddressBook(state) {
  const { network } = state.metamask;
  if (!state.metamask.addressBook[network]) {
    return [];
  }
  return Object.values(state.metamask.addressBook[network]);
}

export function getAddressBookEntry(state, address) {
  const addressBook = getAddressBook(state);
  const entry = addressBook.find(
    (contact) => contact.address === checksumAddress(address),
  );
  return entry;
}

export function getAddressBookEntryName(state, address) {
  const entry =
    getAddressBookEntry(state, address) || state.metamask.identities[address];
  return entry && entry.name !== '' ? entry.name : shortenAddress(address);
}

export function accountsWithSendEtherInfoSelector(state) {
  const accounts = getMetaMaskAccounts(state);
  const identities = getMetaMaskIdentities(state);

  const accountsWithSendEtherInfo = Object.entries(identities).map(
    ([key, identity]) => {
      return { ...identity, ...accounts[key] };
    },
  );

  return accountsWithSendEtherInfo;
}

export function getAccountsWithLabels(state) {
  return getMetaMaskAccountsOrdered(state).map(
    ({ address, name, balance }) => ({
      address,
      addressLabel: `${name} (...${address.slice(address.length - 4)})`,
      label: name,
      balance,
    }),
  );
}

export function getCurrentAccountWithSendEtherInfo(state) {
  const currentAddress = getSelectedAddress(state);
  const accounts = accountsWithSendEtherInfoSelector(state);

  return getAccountByAddress(accounts, currentAddress);
}

export function getCurrentAccountStakes(state) {
  const currentAddress = getSelectedAddress(state);
  return getTargetAccountStakes(state, currentAddress);
}

export function getTargetAccountStakes(state, targetAddress) {
  const accounts = getMetaMaskAccountsRaw(state);
  const account = accounts[targetAddress];
  return account?.stakes || [];
}

export function getTargetAccountWithSendEtherInfo(state, targetAddress) {
  const accounts = accountsWithSendEtherInfoSelector(state);
  return getAccountByAddress(accounts, targetAddress);
}

export function getCurrentEthBalance(state) {
  return getCurrentAccountWithSendEtherInfo(state)?.balance;
}

export function getCurrentThetaBalance(state) {
  return getCurrentAccountWithSendEtherInfo(state)?.balance2;
}

export function getGasIsLoading(state) {
  return state.appState.gasIsLoading;
}

export function getBasicGasEstimates(state, networkId) {
  const useNetworkId = networkId || getCurrentNetworkId(state);
  return state.metamask.gasPricing[useNetworkId]?.basicGasEstimates;
}

export function getAverageGasPriceParams(state, eip1559) {
  const useEip1559 = eip1559 ?? getNetworkEip1559Compatible(state);
  const gasPricing = getBasicGasEstimates(state);
  return (
    (gasPricing && {
      ...(useEip1559 && {
        maxFeePerGas: addHexPrefix(
          decGWEIToHexWEI(
            (gasPricing.baseFee || 0) * baseFeeMultiplier + gasPricing.average,
          ),
        ),
        maxPriorityFeePerGas: addHexPrefix(decGWEIToHexWEI(gasPricing.average)),
      }),
      ...(!useEip1559 && {
        gasPrice: addHexPrefix(
          decGWEIToHexWEI(gasPricing.average + (gasPricing.baseFee ?? 0)),
        ),
      }),
    }) ||
    undefined
  );
}

export function getNetworkEip1559Compatible(state, networkId) {
  const useNetworkId = networkId || getCurrentNetworkId(state);
  return state.metamask.gasPricing[useNetworkId]?.eip1559Compatible;
}

export function getNetworkGasFixedPrice(state, networkId) {
  const useNetworkId = networkId || getCurrentNetworkId(state);
  return state.metamask.gasPricing[useNetworkId]?.fixedPrice;
}

export function getCurrentCurrency(state) {
  return state.metamask.currentCurrency;
}

export function getTotalUnapprovedCount(state) {
  const {
    unapprovedMsgCount = 0,
    unapprovedPersonalMsgCount = 0,
    unapprovedDecryptMsgCount = 0,
    unapprovedEncryptionPublicKeyMsgCount = 0,
    unapprovedTypedMessagesCount = 0,
  } = state.metamask;

  return (
    unapprovedMsgCount +
    unapprovedPersonalMsgCount +
    unapprovedDecryptMsgCount +
    unapprovedEncryptionPublicKeyMsgCount +
    unapprovedTypedMessagesCount +
    getUnapprovedTxCount(state) +
    getPermissionsRequestCount(state) +
    getSuggestedTokenCount(state)
  );
}

function getUnapprovedTxCount(state) {
  const { unapprovedTxs = {} } = state.metamask;
  return Object.keys(unapprovedTxs).length;
}

function getSuggestedTokenCount(state) {
  const { suggestedTokens = {} } = state.metamask;
  return Object.keys(suggestedTokens).length;
}

export function getIsMainnet(state) {
  const networkType = getNetworkIdentifier(state);
  return networkType === NETWORK_TYPES.MAINNET;
}

export function getIsThetaMainnet(state) {
  const { provider } = state.metamask;
  const chainId =
    NETWORK_TYPE_TO_ID_MAP[provider.type]?.chainId || provider.chainId;
  return (
    chainId === THETAMAINNET_CHAIN_ID || chainId === THETAMAINNET_NETWORK_ID
  );
}

export function getPreferences({ metamask }) {
  return metamask.preferences;
}

export function getShouldShowFiat(state) {
  const isMainNet = getIsMainnet(state);
  const isThetaMainNet = getIsThetaMainnet(state);
  const conversionRate = getConversionRate(state);
  const { showFiatInTestnets } = getPreferences(state);
  return Boolean(
    (isMainNet || isThetaMainNet || showFiatInTestnets) && conversionRate,
  );
}

export function getAdvancedInlineGasShown(state) {
  return Boolean(state.metamask.featureFlags.advancedInlineGas);
}

export function getUseNonceField(state) {
  return Boolean(state.metamask.useNonceField);
}

export function getCustomNonceValue(state) {
  return String(state.metamask.customNonceValue);
}

export function getDomainMetadata(state) {
  return state.metamask.domainMetadata;
}

export function getRpcPrefsForCurrentProvider(state) {
  const { frequentRpcListDetail, provider } = state.metamask;
  const chainId =
    NETWORK_TYPE_TO_ID_MAP[provider.type]?.chainId || provider.chainId;
  if (
    chainId === THETAMAINNET_CHAIN_ID ||
    chainId === THETAMAINNET_NETWORK_ID
  ) {
    return provider.rpcPrefs;
  }
  const selectRpcInfo = frequentRpcListDetail.find(
    (rpcInfo) => rpcInfo.rpcUrl === provider.rpcTarget,
  );
  const { rpcPrefs = {} } = selectRpcInfo || {};
  return rpcPrefs;
}

export function getSelectedNative(state) {
  return Boolean(state.metamask.provider.rpcPrefs?.selectedNative);
}

export function getKnownMethodData(state, data) {
  if (!data) {
    return null;
  }
  const prefixedData = addHexPrefix(data);
  const fourBytePrefix = prefixedData.slice(0, 10);
  const { knownMethodData } = state.metamask;

  return knownMethodData && knownMethodData[fourBytePrefix];
}

export function getFeatureFlags(state) {
  return state.metamask.featureFlags;
}

export function getOriginOfCurrentTab(state) {
  return state.activeTab.origin;
}

export function getIpfsGateway(state) {
  return state.metamask.ipfsGateway;
}
