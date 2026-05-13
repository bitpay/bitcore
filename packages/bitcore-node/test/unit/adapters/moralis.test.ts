import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { AdapterError, AdapterErrorCode } from '../../../src/providers/chain-state/external/adapters/errors';
import { MoralisAdapter } from '../../../src/providers/chain-state/external/adapters/moralis';
import {
  buildMoralisQueryString,
  formatMoralisChainId,
  transformMoralisInternalTx,
  transformMoralisQueryParams,
  transformMoralisTokenTransfer,
  transformMoralisTransaction
} from '../../../src/providers/chain-state/external/adapters/moralis-utils';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import config from '../../../src/config';

const VALID_TX_HASH = '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1';

const MOCK_MORALIS_TX = {
  chain: 'ETH',
  network: 'mainnet',
  hash: VALID_TX_HASH,
  block_number: '18000000',
  block_hash: '0xblockhash123',
  block_timestamp: '2023-09-01T12:00:00.000Z',
  value: '1000000000000000000',
  gas: '21000',
  gas_price: '20000000000',
  receipt_gas_used: '21000',
  nonce: 5,
  to_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1E',
  from_address: '0x388C818CA8B9251b393131C08a736A67ccB19297',
  input: '0x',
  internal_transactions: [],
  category: 'token send',
  transaction_index: 42
};

describe('MoralisAdapter', function () {
  let sandbox: sinon.SinonSandbox;
  let adapter: MoralisAdapter;
  let axiosGetStub: sinon.SinonStub;
  const savedExternalProviders = config.externalProviders;

  before(function () {
    (config as any).externalProviders = {
      ...savedExternalProviders,
      moralis: { apiKey: 'test-moralis-key' }
    };
  });

  after(function () {
    (config as any).externalProviders = savedExternalProviders;
  });

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    sandbox.stub(EVMTransactionStorage, 'addEffectsToTxs').callsFake(() => {});
    sandbox.stub(EVMTransactionStorage, 'abiDecode').returns(undefined as any);
    sandbox.stub(EVMTransactionStorage, '_apiTransform').callsFake((tx: any) => tx);
    axiosGetStub = sandbox.stub(axios, 'get');
    adapter = new MoralisAdapter({ name: 'moralis', priority: 1 });
  });

  afterEach(function () {
    sandbox.restore();
  });

  // --- Constructor ---
  describe('constructor', function () {
    it('should throw if apiKey missing from config', function () {
      const saved = config.externalProviders;
      (config as any).externalProviders = { moralis: { apiKey: '' } };
      expect(() => new MoralisAdapter({ name: 'moralis', priority: 1 }))
        .to.throw('apiKey is required');
      (config as any).externalProviders = saved;
    });

    it('should set the adapter name', function () {
      expect(adapter.name).to.equal('Moralis');
    });
  });

  // --- getTransaction ---
  describe('getTransaction', function () {
    const params = { chain: 'ETH', network: 'mainnet', chainId: '1', txId: VALID_TX_HASH };

    it('should fetch and transform a transaction', async function () {
      axiosGetStub.resolves({ data: MOCK_MORALIS_TX });
      const result = await adapter.getTransaction(params);
      expect(result).to.exist;
      expect(result!.txid).to.equal(VALID_TX_HASH);
      expect(result!.blockHeight).to.equal(18000000);
    });

    it('should return undefined on 404', async function () {
      axiosGetStub.rejects({ isAxiosError: true, response: { status: 404 } });
      expect(await adapter.getTransaction(params)).to.be.undefined;
    });

    it('should return undefined when response data is empty', async function () {
      axiosGetStub.resolves({ data: null });
      expect(await adapter.getTransaction(params)).to.be.undefined;
    });

    it('should throw INVALID_REQUEST for bad txId format', async function () {
      try {
        await adapter.getTransaction({ ...params, txId: 'not-a-hash' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(AdapterError);
        expect(err.code).to.equal(AdapterErrorCode.INVALID_REQUEST);
        expect(axiosGetStub.called).to.be.false;
      }
    });
  });

  // --- Error classification ---
  describe('error classification', function () {
    const params = { chain: 'ETH', network: 'mainnet', chainId: '1', txId: VALID_TX_HASH };

    const errorCases: Array<{ scenario: string; error: any; expectedCode: AdapterErrorCode }> = [
      {
        scenario: 'HTTP 401 → AUTH',
        error: { isAxiosError: true, response: { status: 401 } },
        expectedCode: AdapterErrorCode.AUTH
      },
      {
        scenario: 'HTTP 403 → AUTH',
        error: { isAxiosError: true, response: { status: 403 } },
        expectedCode: AdapterErrorCode.AUTH
      },
      {
        scenario: 'HTTP 429 → RATE_LIMIT',
        error: { isAxiosError: true, response: { status: 429 } },
        expectedCode: AdapterErrorCode.RATE_LIMIT
      },
      {
        scenario: 'HTTP 500 → UPSTREAM',
        error: { isAxiosError: true, response: { status: 500 } },
        expectedCode: AdapterErrorCode.UPSTREAM
      },
      {
        scenario: 'timeout → TIMEOUT',
        error: { isAxiosError: true, code: 'ECONNABORTED' },
        expectedCode: AdapterErrorCode.TIMEOUT
      }
    ];

    for (const { scenario, error, expectedCode } of errorCases) {
      it(`should classify ${scenario}`, async function () {
        axiosGetStub.rejects(error);
        try {
          await adapter.getTransaction(params);
          expect.fail('Should have thrown');
        } catch (err: any) {
          expect(err).to.be.instanceOf(AdapterError);
          expect(err.code).to.equal(expectedCode);
        }
      });
    }
  });

  // --- healthCheck ---
  describe('healthCheck', function () {
    it('should return true on success', async function () {
      axiosGetStub.resolves({ data: {} });
      expect(await adapter.healthCheck()).to.equal(true);
    });

    it('should return false on failure', async function () {
      axiosGetStub.rejects(new Error('network error'));
      expect(await adapter.healthCheck()).to.equal(false);
    });
  });

  // --- chainId in query ---
  describe('chainId in requests', function () {
    const params = { chain: 'ETH', network: 'mainnet', chainId: '1', txId: VALID_TX_HASH };

    it('should pass hex chainId through', async function () {
      axiosGetStub.resolves({ data: MOCK_MORALIS_TX });
      await adapter.getTransaction({ ...params, chainId: '0x1' });
      expect(axiosGetStub.firstCall.args[0]).to.include('chain=0x1');
    });

    it('should convert decimal chainId to hex', async function () {
      axiosGetStub.resolves({ data: MOCK_MORALIS_TX });
      await adapter.getTransaction({ ...params, chainId: '137' });
      expect(axiosGetStub.firstCall.args[0]).to.include('chain=0x89');
    });
  });

  // --- Shared moralis-utils ---
  describe('moralis-utils', function () {
    describe('transformMoralisTransaction', function () {
      it('should map snake_case Moralis fields to IEVMTransactionTransformed', function () {
        const result = transformMoralisTransaction(MOCK_MORALIS_TX);
        expect(result.txid).to.equal(MOCK_MORALIS_TX.hash);
        expect(result.blockHeight).to.equal(18000000);
        expect(result.chain).to.equal('ETH');
        expect(result.network).to.equal('mainnet');
      });

      it('should handle camelCase field variants', function () {
        const camelTx = {
          ...MOCK_MORALIS_TX,
          block_number: undefined,
          blockNumber: '18000000',
          block_timestamp: undefined,
          blockTimestamp: '2023-09-01T12:00:00.000Z',
          to_address: undefined,
          toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1E',
          from_address: undefined,
          fromAddress: '0x388C818CA8B9251b393131C08a736A67ccB19297',
          gas_price: undefined,
          gasPrice: '20000000000',
          receipt_gas_used: undefined,
          receiptGasUsed: '21000'
        };
        const result = transformMoralisTransaction(camelTx);
        expect(result.blockHeight).to.equal(18000000);
      });

      it('should use transaction_hash for ERC20 transfers', function () {
        const erc20 = { ...MOCK_MORALIS_TX, hash: undefined, transaction_hash: '0xerc20hash' };
        const result = transformMoralisTransaction(erc20);
        expect(result.txid).to.equal('0xerc20hash');
      });
    });

    describe('transformMoralisInternalTx', function () {
      it('should map internal transaction fields', function () {
        const internal = {
          from: '0x388C818CA8B9251b393131C08a736A67ccB19297',
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1E',
          gas: '21000',
          gas_used: '21000',
          input: '0x',
          output: '0x',
          type: 'CALL',
          value: '1000000000000000000'
        };
        const result = transformMoralisInternalTx(internal);
        expect(result.type).to.equal('CALL');
        expect(result.value).to.equal('1000000000000000000');
      });
    });

    describe('transformMoralisTokenTransfer', function () {
      it('should extend base transaction with token fields', function () {
        const transfer = {
          ...MOCK_MORALIS_TX,
          transaction_hash: MOCK_MORALIS_TX.hash,
          contract_address: '0xtokencontract',
          token_name: 'USDC'
        };
        const result = transformMoralisTokenTransfer(transfer);
        expect(result.contractAddress).to.equal('0xtokencontract');
        expect(result.name).to.equal('USDC');
      });
    });

    describe('formatMoralisChainId', function () {
      it('should pass through hex chainId unchanged', function () {
        expect(formatMoralisChainId('0x1')).to.equal('0x1');
      });

      it('should convert decimal string to hex', function () {
        expect(formatMoralisChainId('137')).to.equal('0x89');
      });

      it('should convert bigint to hex', function () {
        expect(formatMoralisChainId(BigInt(1))).to.equal('0x1');
      });

      it('should throw for invalid chainId', function () {
        expect(() => formatMoralisChainId('not-a-number')).to.throw();
      });
    });

    describe('buildMoralisQueryString', function () {
      it('should build key=value pairs', function () {
        const qs = buildMoralisQueryString({ chain: '0x1', limit: 10 });
        expect(qs).to.equal('?chain=0x1&limit=10');
      });

      it('should encode array values', function () {
        const qs = buildMoralisQueryString({ contract_addresses: ['0xA', '0xB'] });
        expect(qs).to.include('contract_addresses%5B0%5D=0xA');
        expect(qs).to.include('contract_addresses%5B1%5D=0xB');
      });

      it('should skip null/undefined values', function () {
        const qs = buildMoralisQueryString({ chain: '0x1', extra: null });
        expect(qs).to.equal('?chain=0x1');
      });

      it('should return empty string for no params', function () {
        expect(buildMoralisQueryString({})).to.equal('');
      });
    });

    describe('transformMoralisQueryParams', function () {
      it('should add block range when startBlock/endBlock present', function () {
        const result = transformMoralisQueryParams({ chainId: '1', args: { startBlock: 100, endBlock: 200 } });
        expect(result.from_block).to.equal(100);
        expect(result.to_block).to.equal(200);
      });

      it('should add date range when no block range', function () {
        const result = transformMoralisQueryParams({ chainId: '1', args: { startDate: '2023-01-01', endDate: '2023-12-31' } });
        expect(result.from_date).to.equal('2023-01-01');
        expect(result.to_date).to.equal('2023-12-31');
      });

      it('should convert positive direction to ASC', function () {
        const result = transformMoralisQueryParams({ chainId: '1', args: { direction: 1 } });
        expect(result.order).to.equal('ASC');
      });

      it('should convert negative direction to DESC', function () {
        const result = transformMoralisQueryParams({ chainId: '1', args: { direction: -1 } });
        expect(result.order).to.equal('DESC');
      });
    });
  });
});
