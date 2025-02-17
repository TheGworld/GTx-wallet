import Web3 from 'web3';
import { ObservableStore } from '@metamask/obs-store';
import { normalize as normalizeAddress } from 'eth-sig-util';
import { isValidAddress, toChecksumAddress } from 'ethereumjs-util';
import abiERC721 from 'human-standard-collectible-abi';
import log from 'loglevel';
import { isEqual } from 'lodash';
import contracts from '../../../gtx/mergedTokens';
import { normalizeTokenLogoUrl } from '../../../ui/helpers/utils/token-util';
import { addInternalMethodPrefix } from './permissions';

const ERC721_INTERFACE_ID = '0x80ac58cd';

export default class PreferencesController {
  /**
   *
   * @typedef {Object} PreferencesController
   * @param {Object} opts - Overrides the defaults for the initial state of this.store
   * @property {object} store The stored object containing a users preferences, stored in local storage
   * @property {array} store.frequentRpcList A list of custom rpcs to provide the user
   * @property {array} store.tokens The tokens the user wants display in their token lists
   * @property {object} store.accountTokens The tokens stored per account and then per network type
   * @property {object} store.assetImages Contains assets objects related to assets added
   * @property {boolean} store.useBlockie The users preference for blockie identicons within the UI
   * @property {boolean} store.useNonceField The users preference for nonce field within the UI
   * @property {object} store.featureFlags A key-boolean map, where keys refer to features and booleans to whether the
   * user wishes to see that feature.
   *
   * Feature flags can be set by the global function `setPreference(feature, enabled)`, and so should not expose any sensitive behavior.
   * @property {object} store.knownMethodData Contains all data methods known by the user
   * @property {string} store.currentLocale The preferred language locale key
   * @property {string} store.selectedAddress A hex string that matches the currently selected address in the app
   * @property {Object} store.selectedNFT
   * // TODO: add any missing properties here
   */
  constructor(opts = {}) {
    const initState = {
      frequentRpcListDetail: [],
      accountTokens: {},
      assetImages: {},
      tokens: [],
      suggestedTokens: {},
      useBlockie: false,
      useNonceField: false,
      usePhishDetect: true,

      // WARNING: Do not use feature flags for security-sensitive things.
      // Feature flag toggling is available in the global namespace
      // for convenient testing of pre-release features, and should never
      // perform sensitive operations.
      featureFlags: {
        showIncomingTransactions: true,
      },
      knownMethodData: {},
      firstTimeFlowType: null,
      currentLocale: opts.initLangCode,
      identities: {},
      lostIdentities: {},
      forgottenPassword: false,
      preferences: {
        autoLockTimeLimit: undefined,
        showFiatInTestnets: false,
        useNativeCurrencyAsPrimaryCurrency: true,
      },
      completedOnboarding: false,

      // ENS decentralized website resolution
      ipfsGateway: 'dweb.link',

      ...opts.initState,
    };

    this.diagnostics = opts.diagnostics;
    this.network = opts.network;
    this.store = new ObservableStore(initState);
    this.store.setMaxListeners(16);
    this.openPopup = opts.openPopup;
    this._subscribeProviderType();

    global.setPreference = (key, value) => {
      return this.setFeatureFlag(key, value);
    };
  }

  /**
   * @type {Object}
   */
  set network(network) {
    if (!network) {
      return;
    }
    this._network = network;
    this.web3 = network._provider ? new Web3(network._provider) : null;
  }

  // PUBLIC METHODS

  /**
   * Sets the {@code forgottenPassword} state property
   * @param {boolean} forgottenPassword - whether or not the user has forgotten their password
   */
  setPasswordForgotten(forgottenPassword) {
    this.store.updateState({ forgottenPassword });
  }

  /**
   * Setter for the `useBlockie` property
   *
   * @param {boolean} val - Whether or not the user prefers blockie indicators
   *
   */
  setUseBlockie(val) {
    this.store.updateState({ useBlockie: val });
  }

  /**
   * Setter for the `useNonceField` property
   *
   * @param {boolean} val - Whether or not the user prefers to set nonce
   *
   */
  setUseNonceField(val) {
    this.store.updateState({ useNonceField: val });
  }

  /**
   * Setter for the `usePhishDetect` property
   *
   * @param {boolean} val - Whether or not the user prefers phishing domain protection
   *
   */
  setUsePhishDetect(val) {
    this.store.updateState({ usePhishDetect: val });
  }

  /**
   * Setter for the `firstTimeFlowType` property
   *
   * @param {string} type - Indicates the type of first time flow - create or import - the user wishes to follow
   *
   */
  setFirstTimeFlowType(type) {
    this.store.updateState({ firstTimeFlowType: type });
  }

  getSuggestedTokens() {
    return this.store.getState().suggestedTokens;
  }

  getAssetImages() {
    return this.store.getState().assetImages;
  }

  addSuggestedERC20Asset(tokenOpts) {
    this._validateERC20AssetParams(tokenOpts);
    const suggested = this.getSuggestedTokens();
    const { rawAddress, symbol, decimals, image } = tokenOpts;
    const address = normalizeAddress(rawAddress);
    const newEntry = { address, symbol, decimals, image };
    suggested[address] = newEntry;
    this.store.updateState({ suggestedTokens: suggested });
  }

  /**
   * Add new methodData to state, to avoid requesting this information again through Infura
   *
   * @param {string} fourBytePrefix - Four-byte method signature
   * @param {string} methodData - Corresponding data method
   */
  addKnownMethodData(fourBytePrefix, methodData) {
    const { knownMethodData } = this.store.getState();
    knownMethodData[fourBytePrefix] = methodData;
    this.store.updateState({ knownMethodData });
  }

  /**
   * RPC engine middleware for requesting new asset added
   *
   * @param req
   * @param res
   * @param {Function} - next
   * @param {Function} - end
   */
  async requestWatchAsset(req, res, next, end) {
    if (
      req.method === 'metamask_watchAsset' ||
      req.method === addInternalMethodPrefix('watchAsset')
    ) {
      const { type, options } = req.params;
      switch (type) {
        case 'ERC20': {
          const result = await this._handleWatchAssetERC20(options);
          if (result instanceof Error) {
            end(result);
          } else {
            res.result = result;
            end();
          }
          return;
        }
        default:
          end(new Error(`Asset of type ${type} not supported`));
          return;
      }
    }

    next();
  }

  /**
   * Setter for the `currentLocale` property
   *
   * @param {string} key - he preferred language locale key
   *
   */
  setCurrentLocale(key) {
    const textDirection = ['ar', 'dv', 'fa', 'he', 'ku'].includes(key)
      ? 'rtl'
      : 'auto';
    this.store.updateState({
      currentLocale: key,
      textDirection,
    });
    return textDirection;
  }

  /**
   * Updates identities to only include specified addresses. Removes identities
   * not included in addresses array
   *
   * @param {string[]} addresses - An array of hex addresses
   *
   */
  setAddresses(addresses) {
    const oldIdentities = this.store.getState().identities;
    const oldAccountTokens = this.store.getState().accountTokens;

    const identities = addresses.reduce((ids, address, index) => {
      const oldId = oldIdentities[address] || {};
      ids[address] = { name: `Account ${index + 1}`, address, ...oldId };
      return ids;
    }, {});
    const accountTokens = addresses.reduce((tokens, address) => {
      const oldTokens = oldAccountTokens[address] || {};
      tokens[address] = oldTokens;
      return tokens;
    }, {});
    this.store.updateState({ identities, accountTokens });
  }

  /**
   * Removes an address from state
   *
   * @param {string} address - A hex address
   * @returns {string} - the address that was removed
   */
  removeAddress(address) {
    const { identities } = this.store.getState();
    const { accountTokens } = this.store.getState();
    if (!identities[address]) {
      throw new Error(`${address} can't be deleted cause it was not found`);
    }
    delete identities[address];
    delete accountTokens[address];
    this.store.updateState({ identities, accountTokens });

    // If the selected account is no longer valid,
    // select an arbitrary other account:
    if (address === this.getSelectedAddress()) {
      const selected = Object.keys(identities)[0];
      this.setSelectedAddress(selected);
    }
    return address;
  }

  /**
   * Adds addresses to the identities object without removing identities
   *
   * @param {string[]} addresses - An array of hex addresses
   *
   */
  addAddresses(addresses) {
    const { identities, accountTokens } = this.store.getState();
    addresses.forEach((address) => {
      // skip if already exists
      if (identities[address]) {
        return;
      }
      // add missing identity
      const identityCount = Object.keys(identities).length;

      accountTokens[address] = {};
      identities[address] = { name: `Account ${identityCount + 1}`, address };
    });
    this.store.updateState({ identities, accountTokens });
  }

  /**
   * Synchronizes identity entries with known accounts.
   * Removes any unknown identities, and returns the resulting selected address.
   *
   * @param {Array<string>} addresses - known to the vault.
   * @returns {Promise<string>} - selectedAddress the selected address.
   */
  syncAddresses(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('Expected non-empty array of addresses.');
    }

    const { identities, lostIdentities } = this.store.getState();

    const newlyLost = {};
    Object.keys(identities).forEach((identity) => {
      if (!addresses.includes(identity)) {
        newlyLost[identity] = identities[identity];
        delete identities[identity];
      }
    });

    // Identities are no longer present.
    if (Object.keys(newlyLost).length > 0) {
      // Notify our servers:
      if (this.diagnostics) {
        this.diagnostics.reportOrphans(newlyLost);
      }

      // store lost accounts
      Object.keys(newlyLost).forEach((key) => {
        lostIdentities[key] = newlyLost[key];
      });
    }

    this.store.updateState({ identities, lostIdentities });
    this.addAddresses(addresses);

    // If the selected account is no longer valid,
    // select an arbitrary other account:
    let selected = this.getSelectedAddress();
    if (!addresses.includes(selected)) {
      selected = addresses[0];
      this.setSelectedAddress(selected);
    }

    return selected;
  }

  removeSuggestedTokens() {
    return new Promise((resolve) => {
      this.store.updateState({ suggestedTokens: {} });
      resolve({});
    });
  }

  /**
   * Setter for the `selectedAddress` property
   *
   * @param {string} _address - A new hex address for an account
   * @returns {Promise<void>} - Promise resolves with tokens
   *
   */
  setSelectedAddress(_address) {
    const address = normalizeAddress(_address);
    this._updateTokens(address);

    const { identities, tokens } = this.store.getState();
    const selectedIdentity = identities[address];
    if (!selectedIdentity) {
      throw new Error(`Identity for '${address} not found`);
    }

    selectedIdentity.lastSelected = Date.now();
    this.store.updateState({ identities, selectedAddress: address });
    return Promise.resolve(tokens);
  }

  /**
   * Getter for the `selectedAddress` property
   *
   * @returns {string} - The hex address for the currently selected account
   *
   */
  getSelectedAddress() {
    return this.store.getState().selectedAddress;
  }

  setSelectedNFT(nft) {
    this.store.updateState({ selectedNFT: nft });
  }

  getSelectedNFT() {
    return this.store.getState().selectedNFT;
  }

  setGtxTokens(gtxTokens) {
    this.store.updateState({ gtxTokens });
  }

  getGtxTokens() {
    return this.store.getState().gtxTokens;
  }

  /**
   * Contains data about tokens users add to their account.
   * @typedef {Object} AddedToken
   * @property {string} address - The hex address for the token contract. Will be all lower cased and hex-prefixed.
   * @property {string} symbol - The symbol of the token, usually 3 or 4 capitalized letters
   *  {@link https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md#symbol}
   * @property {boolean} decimals - The number of decimals the token uses.
   *  {@link https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md#decimals}
   */

  /**
   * Adds a new token to the token array, or updates the token if passed an address that already exists.
   * Modifies the existing tokens array from the store. All objects in the tokens array array AddedToken objects.
   * @see AddedToken {@link AddedToken}
   *
   * @param {string} rawAddress - Hex address of the token contract. May or may not be a checksum address.
   * @param {string} symbol - The symbol of the token
   * @param {number} decimals  - The number of decimals the token uses.
   * @param {string} image  - The coin logo image to use.
   * @param {string} chainId  - The hexadecimal chainId with 0x prefix.
   * @param {boolean} isERC721 - If token is ERC/TNT/etc-721 (NFT) or not.
   * @param {Object} staking - Info on staking of token if any
   * @param {Object} stakedAsset - staking contract token info if any
   * @param {Array} skipChainIds - chains to skip token tracking
   * @returns {Promise<array>} - Promises the new array of AddedToken objects.
   *
   */
  async addToken(
    rawAddress,
    symbol,
    decimals,
    image,
    chainId,
    isERC721,
    staking,
    stakedAsset,
    skipChainIds,
    unsendable = false,
  ) {
    const address = normalizeAddress(rawAddress);
    const newEntry = {
      address,
      symbol,
      decimals: Number(decimals),
      staking,
      stakedAsset,
      chainId,
      skipChainIds,
      unsendable,
    };
    const { tokens } = this.store.getState();
    const assetImages = this.getAssetImages();
    const previousEntry = tokens.find((token) => {
      return token.address === address;
    });
    const previousIndex = tokens.indexOf(previousEntry);

    newEntry.isERC721 =
      typeof isERC721 === 'undefined'
        ? await this._detectIsERC721(newEntry.address)
        : isERC721;
    if (newEntry.isERC721) {
      newEntry.decimals = 0;
    }

    if (previousEntry) {
      if (
        newEntry.address !== previousEntry.address ||
        newEntry.symbol !== previousEntry.symbol ||
        newEntry.decimals?.toString() !== previousEntry.decimals?.toString() ||
        Boolean(newEntry.isERC721) !== Boolean(previousEntry.isERC721) ||
        !isEqual(newEntry.staking, previousEntry.staking) ||
        !isEqual(newEntry.stakedAsset, previousEntry.stakedAsset)
      ) {
        tokens[previousIndex] = newEntry;
      }
    } else {
      tokens.push(newEntry);
    }

    const knownLogo = contracts[toChecksumAddress(address)]?.logo;
    const knownLogoFull = knownLogo && normalizeTokenLogoUrl(knownLogo);
    assetImages[address] = image ?? knownLogoFull ?? assetImages[address];

    this._updateAccountTokens(tokens, assetImages);
    return Promise.resolve(tokens);
  }

  /**
   * Removes a specified token from the tokens array.
   *
   * @param {string} rawAddress - Hex address of the token contract to remove.
   * @returns {Promise<array>} - The new array of AddedToken objects
   *
   */
  removeToken(rawAddress) {
    const { tokens } = this.store.getState();
    const assetImages = this.getAssetImages();
    const updatedTokens = tokens.filter(
      (token) => token.address !== rawAddress,
    );
    delete assetImages[rawAddress];
    this._updateAccountTokens(updatedTokens, assetImages);
    return Promise.resolve(updatedTokens);
  }

  /**
   * A getter for the `tokens` property
   *
   * @returns {array} - The current array of AddedToken objects
   *
   */
  getTokens() {
    return this.store.getState().tokens;
  }

  /**
   * Sets a custom label for an account
   * @param {string} account - the account to set a label for
   * @param {string} label - the custom label for the account
   * @returns {Promise<string>}
   */
  setAccountLabel(account, label) {
    if (!account) {
      throw new Error(
        `setAccountLabel requires a valid address, got ${String(account)}`,
      );
    }
    const address = normalizeAddress(account);
    const { identities } = this.store.getState();
    identities[address] = identities[address] || {};
    identities[address].name = label;
    this.store.updateState({ identities });
    return Promise.resolve(label);
  }

  /**
   * updates custom RPC details
   * @param {object} newRpcDetails - Options
   * @param {string} newRpcDetails.rpcUrl - The RPC url to add to frequentRpcList.
   * @param {string} newRpcDetails.chainId - Optional chainId of the selected network.
   * @param {string} newRpcDetails.ticker   - Optional ticker symbol of the selected network.
   * @param {string} newRpcDetails.nickname - Optional nickname of the selected network.
   * @param {object} [newRpcDetails.rpcPrefs] - Optional RPC preferences, such as the block explorer URL and selectedNative
   * @returns {Promise<array>} - Promise resolving to updated frequentRpcList.
   *
   */

  updateRpc(newRpcDetails) {
    const rpcList = this.getFrequentRpcListDetail();
    const index = rpcList.findIndex((element) => {
      return element.rpcUrl === newRpcDetails.rpcUrl;
    });
    if (index > -1) {
      const rpcDetail = rpcList[index];
      const updatedRpc = { ...rpcDetail, ...newRpcDetails };
      rpcList[index] = updatedRpc;
      this.store.updateState({ frequentRpcListDetail: rpcList });
    } else {
      const {
        rpcUrl,
        chainId,
        ticker,
        nickname,
        rpcPrefs = {},
      } = newRpcDetails;
      return this.addToFrequentRpcList(
        rpcUrl,
        chainId,
        ticker,
        nickname,
        rpcPrefs,
      );
    }
    return Promise.resolve(rpcList);
  }

  /**
   * Adds custom RPC url to state.
   *
   * @param {string} url - The RPC url to add to frequentRpcList.
   * @param {string} chainId - Optional chainId of the selected network.
   * @param {string} ticker   - Optional ticker symbol of the selected network.
   * @param {string} nickname - Optional nickname of the selected network.
   * @returns {Promise<array>} - Promise resolving to updated frequentRpcList.
   *
   */
  addToFrequentRpcList(
    url,
    chainId,
    ticker = 'ETH',
    nickname = '',
    rpcPrefs = {},
  ) {
    const rpcList = this.getFrequentRpcListDetail();
    const index = rpcList.findIndex((element) => {
      return element.rpcUrl === url;
    });
    if (index !== -1) {
      rpcList.splice(index, 1);
    }
    if (url !== 'http://localhost:8545') {
      let checkedChainId;
      // eslint-disable-next-line radix
      if (Boolean(chainId) && !Number.isNaN(parseInt(chainId))) {
        checkedChainId = chainId;
      }
      rpcList.push({
        rpcUrl: url,
        chainId: checkedChainId,
        ticker,
        nickname,
        rpcPrefs,
      });
    }
    this.store.updateState({ frequentRpcListDetail: rpcList });
    return Promise.resolve(rpcList);
  }

  /**
   * Removes custom RPC url from state.
   *
   * @param {string} url - The RPC url to remove from frequentRpcList.
   * @returns {Promise<array>} - Promise resolving to updated frequentRpcList.
   *
   */
  removeFromFrequentRpcList(url) {
    const rpcList = this.getFrequentRpcListDetail();
    const index = rpcList.findIndex((element) => {
      return element.rpcUrl === url;
    });
    if (index !== -1) {
      rpcList.splice(index, 1);
    }
    this.store.updateState({ frequentRpcListDetail: rpcList });
    return Promise.resolve(rpcList);
  }

  /**
   * Getter for the `frequentRpcListDetail` property.
   *
   * @returns {array<array>} - An array of rpc urls.
   *
   */
  getFrequentRpcListDetail() {
    return this.store.getState().frequentRpcListDetail;
  }

  /**
   * Updates the `featureFlags` property, which is an object. One property within that object will be set to a boolean.
   *
   * @param {string} feature - A key that corresponds to a UI feature.
   * @param {boolean} activated - Indicates whether or not the UI feature should be displayed
   * @returns {Promise<object>} - Promises a new object; the updated featureFlags object.
   *
   */
  setFeatureFlag(feature, activated) {
    const currentFeatureFlags = this.store.getState().featureFlags;
    const updatedFeatureFlags = {
      ...currentFeatureFlags,
      [feature]: activated,
    };

    this.store.updateState({ featureFlags: updatedFeatureFlags });

    return Promise.resolve(updatedFeatureFlags);
  }

  /**
   * Updates the `preferences` property, which is an object. These are user-controlled features
   * found in the settings page.
   * @param {string} preference - The preference to enable or disable.
   * @param {boolean} value - Indicates whether or not the preference should be enabled or disabled.
   * @returns {Promise<object>} - Promises a new object; the updated preferences object.
   */
  setPreference(preference, value) {
    const currentPreferences = this.getPreferences();
    const updatedPreferences = {
      ...currentPreferences,
      [preference]: value,
    };

    this.store.updateState({ preferences: updatedPreferences });
    return Promise.resolve(updatedPreferences);
  }

  /**
   * A getter for the `preferences` property
   * @returns {Object} - A key-boolean map of user-selected preferences.
   */
  getPreferences() {
    return this.store.getState().preferences;
  }

  /**
   * Sets the completedOnboarding state to true, indicating that the user has completed the
   * onboarding process.
   */
  completeOnboarding() {
    this.store.updateState({ completedOnboarding: true });
    return Promise.resolve(true);
  }

  /**
   * A getter for the `ipfsGateway` property
   * @returns {string} - The current IPFS gateway domain
   */
  getIpfsGateway() {
    return this.store.getState().ipfsGateway;
  }

  /**
   * A setter for the `ipfsGateway` property
   * @param {string} domain - The new IPFS gateway domain
   * @returns {Promise<string>} - A promise of the update IPFS gateway domain
   */
  setIpfsGateway(domain) {
    this.store.updateState({ ipfsGateway: domain });
    return Promise.resolve(domain);
  }

  //
  // PRIVATE METHODS
  //

  /**
   * Subscription to network provider type.
   *
   *
   */
  _subscribeProviderType() {
    this._network.providerStore.subscribe(() => {
      const { tokens } = this._getTokenRelatedStates();
      this.store.updateState({ tokens });
    });
  }

  /**
   * Updates `accountTokens` and `tokens` of current account and network according to it.
   *
   * @param {array} tokens - Array of tokens to be updated.
   *
   */
  _updateAccountTokens(tokens, assetImages) {
    const { accountTokens, providerType, selectedAddress } =
      this._getTokenRelatedStates();
    accountTokens[selectedAddress][providerType] = tokens;
    this.store.updateState({ accountTokens, tokens, assetImages });
  }

  /**
   * Updates `tokens` of current account and network.
   *
   * @param {string} selectedAddress - Account address to be updated with.
   *
   */
  _updateTokens(selectedAddress) {
    const { tokens } = this._getTokenRelatedStates(selectedAddress);
    this.store.updateState({ tokens });
  }

  /**
   * Detects whether or not a token is ERC-721 compatible.
   *
   * @param {string} tokensAddress - the token contract address.
   *
   */
  async _detectIsERC721(tokenAddress) {
    const checksumAddress = toChecksumAddress(tokenAddress);
    if (contracts[checksumAddress]) {
      return Boolean(contracts[checksumAddress].erc721);
    }
    return await this._queryContractIsERC721(tokenAddress);
  }

  async _queryContractIsERC721(tokenAddress) {
    try {
      const ethContract = this.web3.eth.contract(abiERC721).at(tokenAddress);
      return new Promise((resolve) => {
        ethContract.supportsInterface(ERC721_INTERFACE_ID, (error, result) => {
          if (error) {
            if (error.data?.message?.indexOf('revert') !== -1) {
              return resolve(false);
            }
            log.debug(error);
            return resolve(null);
          }
          return resolve(result);
        });
      });
    } catch (err) {
      log.debug(err);
      return null;
    }
  }

  /**
   * A getter for `tokens` and `accountTokens` related states.
   *
   * @param {string} [selectedAddress] A new hex address for an account
   * @returns {Object.<array, object, string, string>} - States to interact with tokens in `accountTokens`
   *
   */
  _getTokenRelatedStates(selectedAddress) {
    const { accountTokens } = this.store.getState();
    if (!selectedAddress) {
      // eslint-disable-next-line no-param-reassign
      selectedAddress = this.store.getState().selectedAddress;
    }
    const providerType = this._network.providerStore.getState().type;
    if (!(selectedAddress in accountTokens)) {
      accountTokens[selectedAddress] = {};
    }
    if (!(providerType in accountTokens[selectedAddress])) {
      accountTokens[selectedAddress][providerType] = [];
    }
    const tokens = accountTokens[selectedAddress][providerType];
    return { tokens, accountTokens, providerType, selectedAddress };
  }

  /**
   * Handle the suggestion of an ERC20 asset through `watchAsset`
   * *
   * @param {Promise} promise - Promise according to addition of ERC20 token
   *
   */
  async _handleWatchAssetERC20(options) {
    const { address, symbol, decimals, image } = options;
    const rawAddress = address;
    try {
      this._validateERC20AssetParams({ rawAddress, symbol, decimals });
    } catch (err) {
      return err;
    }
    const tokenOpts = { rawAddress, decimals, symbol, image };
    this.addSuggestedERC20Asset(tokenOpts);
    return this.openPopup().then(() => {
      const tokenAddresses = this.getTokens().filter(
        (token) => token.address === normalizeAddress(rawAddress),
      );
      return tokenAddresses.length > 0;
    });
  }

  /**
   * Validates that the passed options for suggested token have all required properties.
   *
   * @param {Object} opts - The options object to validate
   * @throws {string} Throw a custom error indicating that address, symbol and/or decimals
   * doesn't fulfill requirements
   *
   */
  _validateERC20AssetParams(opts) {
    const { rawAddress, symbol, decimals } = opts;
    if (!rawAddress || !symbol || typeof decimals === 'undefined') {
      throw new Error(
        `Cannot suggest token without address, symbol, and decimals`,
      );
    }
    if (!(symbol.length <= 9)) {
      throw new Error(`Invalid symbol ${symbol} more than nine characters`);
    }
    const numDecimals = parseInt(decimals, 10);
    if (isNaN(numDecimals) || numDecimals > 36 || numDecimals < 0) {
      throw new Error(
        `Invalid decimals ${decimals} must be at least 0, and not over 36`,
      );
    }
    if (!isValidAddress(rawAddress)) {
      throw new Error(`Invalid address ${rawAddress}`);
    }
  }
}
