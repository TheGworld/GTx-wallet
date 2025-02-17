import assert from 'assert';
import proxyquire from 'proxyquire';

const {
  getCustomGasErrors,
  getCustomGasLimit,
  getCustomGasPrice,
  getCustomGasTotal,
  getRenderableBasicEstimateData,
  getRenderableEstimateDataForSmallButtonsFromGWEI,
} = proxyquire('../custom-gas', {});

describe('custom-gas selectors', function () {
  describe('getCustomGasPrice()', function () {
    it('should return gas.customData.price', function () {
      const mockState = { gas: { customData: { price: 'mockPrice' } } };
      assert.equal(getCustomGasPrice(mockState), 'mockPrice');
    });
  });

  describe('getCustomGasLimit()', function () {
    it('should return gas.customData.limit', function () {
      const mockState = { gas: { customData: { limit: 'mockLimit' } } };
      assert.equal(getCustomGasLimit(mockState), 'mockLimit');
    });
  });

  describe('getCustomGasTotal()', function () {
    it('should return gas.customData.total', function () {
      const mockState = { gas: { customData: { total: 'mockTotal' } } };
      assert.equal(getCustomGasTotal(mockState), 'mockTotal');
    });
  });

  describe('getCustomGasErrors()', function () {
    it('should return gas.errors', function () {
      const mockState = { gas: { errors: 'mockErrors' } };
      assert.equal(getCustomGasErrors(mockState), 'mockErrors');
    });
  });

  describe('getRenderableBasicEstimateData()', function () {
    const tests = [
      {
        expectedResult: [
          {
            gasEstimateType: 'SLOW',
            feeInSecondaryCurrency: '$0.01',
            feeInPrimaryCurrency: '0.0000525 ETH',
            priceInHexWei: '0x9502f900',
          },
          {
            gasEstimateType: 'AVERAGE',
            feeInPrimaryCurrency: '0.000084 ETH',
            feeInSecondaryCurrency: '$0.02',
            priceInHexWei: '0xee6b2800',
          },
          {
            gasEstimateType: 'FAST',
            feeInSecondaryCurrency: '$0.03',
            feeInPrimaryCurrency: '0.000105 ETH',
            priceInHexWei: '0x12a05f200',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 255.71,
            currentCurrency: 'usd',
            preferences: {
              showFiatInTestnets: false,
            },
            provider: {
              type: 'mainnet',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 2.5,
              average: 4,
              fast: 5,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            gasEstimateType: 'SLOW',
            feeInSecondaryCurrency: '$0.27',
            feeInPrimaryCurrency: '0.000105 ETH',
            priceInHexWei: '0x12a05f200',
          },
          {
            feeInPrimaryCurrency: '0.000147 ETH',
            feeInSecondaryCurrency: '$0.38',
            gasEstimateType: 'AVERAGE',
            priceInHexWei: '0x1a13b8600',
          },
          {
            gasEstimateType: 'FAST',
            feeInSecondaryCurrency: '$0.54',
            feeInPrimaryCurrency: '0.00021 ETH',
            priceInHexWei: '0x2540be400',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: false,
            },
            provider: {
              type: 'mainnet',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 5,
              average: 7,
              fast: 10,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            gasEstimateType: 'SLOW',
            feeInSecondaryCurrency: '',
            feeInPrimaryCurrency: '0.000105 ETH',
            priceInHexWei: '0x12a05f200',
          },
          {
            gasEstimateType: 'AVERAGE',
            feeInPrimaryCurrency: '0.000147 ETH',
            feeInSecondaryCurrency: '',
            priceInHexWei: '0x1a13b8600',
          },
          {
            gasEstimateType: 'FAST',
            feeInSecondaryCurrency: '',
            feeInPrimaryCurrency: '0.00021 ETH',
            priceInHexWei: '0x2540be400',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: false,
            },
            provider: {
              type: 'rinkeby',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 5,
              average: 7,
              fast: 10,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            gasEstimateType: 'SLOW',
            feeInSecondaryCurrency: '$0.27',
            feeInPrimaryCurrency: '0.000105 ETH',
            priceInHexWei: '0x12a05f200',
          },
          {
            gasEstimateType: 'AVERAGE',
            feeInPrimaryCurrency: '0.000147 ETH',
            feeInSecondaryCurrency: '$0.38',
            priceInHexWei: '0x1a13b8600',
          },
          {
            gasEstimateType: 'FAST',
            feeInSecondaryCurrency: '$0.54',
            feeInPrimaryCurrency: '0.00021 ETH',
            priceInHexWei: '0x2540be400',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: true,
            },
            provider: {
              type: 'rinkeby',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 5,
              average: 7,
              fast: 10,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            gasEstimateType: 'SLOW',
            feeInSecondaryCurrency: '$0.27',
            feeInPrimaryCurrency: '0.000105 ETH',
            priceInHexWei: '0x12a05f200',
          },
          {
            gasEstimateType: 'AVERAGE',
            feeInPrimaryCurrency: '0.000147 ETH',
            feeInSecondaryCurrency: '$0.38',
            priceInHexWei: '0x1a13b8600',
          },
          {
            gasEstimateType: 'FAST',
            feeInSecondaryCurrency: '$0.54',
            feeInPrimaryCurrency: '0.00021 ETH',
            priceInHexWei: '0x2540be400',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: true,
            },
            provider: {
              type: 'mainnet',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 5,
              average: 7,
              fast: 10,
            },
          },
        },
      },
    ];
    it('should return renderable data about basic estimates', function () {
      tests.forEach((test) => {
        assert.deepEqual(
          getRenderableBasicEstimateData(test.mockState, '0x5208'),
          test.expectedResult,
        );
      });
    });
  });

  describe('getRenderableEstimateDataForSmallButtonsFromGWEI()', function () {
    const tests = [
      {
        expectedResult: [
          {
            feeInSecondaryCurrency: '$0.13',
            feeInPrimaryCurrency: '0.00052 ETH',
            gasEstimateType: 'SLOW',
            priceInHexWei: '0x5d21dba00',
          },
          {
            feeInSecondaryCurrency: '$0.16',
            feeInPrimaryCurrency: '0.00063 ETH',
            gasEstimateType: 'AVERAGE',
            priceInHexWei: '0x6fc23ac00',
          },
          {
            feeInSecondaryCurrency: '$0.27',
            feeInPrimaryCurrency: '0.00105 ETH',
            gasEstimateType: 'FAST',
            priceInHexWei: '0xba43b7400',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 255.71,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: false,
            },
            provider: {
              type: 'mainnet',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 25,
              average: 30,
              fast: 50,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            feeInSecondaryCurrency: '$2.68',
            feeInPrimaryCurrency: '0.00105 ETH',
            gasEstimateType: 'SLOW',
            priceInHexWei: '0xba43b7400',
          },
          {
            feeInSecondaryCurrency: '$4.03',
            feeInPrimaryCurrency: '0.00157 ETH',
            gasEstimateType: 'AVERAGE',
            priceInHexWei: '0x1176592e00',
          },
          {
            feeInSecondaryCurrency: '$5.37',
            feeInPrimaryCurrency: '0.0021 ETH',
            gasEstimateType: 'FAST',
            priceInHexWei: '0x174876e800',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: false,
            },
            provider: {
              type: 'mainnet',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 50,
              average: 75,
              fast: 100,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            feeInSecondaryCurrency: '',
            feeInPrimaryCurrency: '0.00105 ETH',
            gasEstimateType: 'SLOW',
            priceInHexWei: '0xba43b7400',
          },
          {
            feeInSecondaryCurrency: '',
            feeInPrimaryCurrency: '0.00157 ETH',
            gasEstimateType: 'AVERAGE',
            priceInHexWei: '0x1176592e00',
          },
          {
            feeInSecondaryCurrency: '',
            feeInPrimaryCurrency: '0.0021 ETH',
            gasEstimateType: 'FAST',
            priceInHexWei: '0x174876e800',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: false,
            },
            provider: {
              type: 'rinkeby',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 50,
              average: 75,
              fast: 100,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            feeInSecondaryCurrency: '$2.68',
            feeInPrimaryCurrency: '0.00105 ETH',
            gasEstimateType: 'SLOW',
            priceInHexWei: '0xba43b7400',
          },
          {
            feeInSecondaryCurrency: '$4.03',
            feeInPrimaryCurrency: '0.00157 ETH',
            gasEstimateType: 'AVERAGE',
            priceInHexWei: '0x1176592e00',
          },
          {
            feeInSecondaryCurrency: '$5.37',
            feeInPrimaryCurrency: '0.0021 ETH',
            gasEstimateType: 'FAST',
            priceInHexWei: '0x174876e800',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: true,
            },
            provider: {
              type: 'rinkeby',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 50,
              average: 75,
              fast: 100,
            },
          },
        },
      },
      {
        expectedResult: [
          {
            feeInSecondaryCurrency: '$2.68',
            feeInPrimaryCurrency: '0.00105 ETH',
            gasEstimateType: 'SLOW',
            priceInHexWei: '0xba43b7400',
          },
          {
            feeInSecondaryCurrency: '$4.03',
            feeInPrimaryCurrency: '0.00157 ETH',
            gasEstimateType: 'AVERAGE',
            priceInHexWei: '0x1176592e00',
          },
          {
            feeInSecondaryCurrency: '$5.37',
            feeInPrimaryCurrency: '0.0021 ETH',
            gasEstimateType: 'FAST',
            priceInHexWei: '0x174876e800',
          },
        ],
        mockState: {
          metamask: {
            conversionRate: 2557.1,
            currentCurrency: 'usd',
            send: {
              gasLimit: '0x5208',
            },
            preferences: {
              showFiatInTestnets: true,
            },
            provider: {
              type: 'mainnet',
            },
          },
          gas: {
            basicEstimates: {
              safeLow: 50,
              average: 75,
              fast: 100,
            },
          },
        },
      },
    ];
    it('should return renderable data about basic estimates appropriate for buttons with less info', function () {
      tests.forEach((test) => {
        assert.deepEqual(
          getRenderableEstimateDataForSmallButtonsFromGWEI(test.mockState),
          test.expectedResult,
        );
      });
    });
  });
});
