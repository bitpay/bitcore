import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import path from 'path';
import {
  InvalidRequestError, AuthError, RateLimitError,
  TimeoutError, UpstreamError
} from '../../../src/providers/chain-state/external/adapters/errors';

// --- Module mocks (must run before AlchemyAdapter import) ---
// @bitpay-labs/* packages are private; src/config.ts needs bitcore.config.json
const mockWeb3 = {
  utils: {
    toChecksumAddress: (addr: string) => {
      if (addr && (!addr.startsWith('0x') || addr.length !== 42)) throw new Error('invalid address');
      return addr;
    }
  }
};

const Module = require('module');
const originalResolve = Module._resolveFilename;
const mockModules: Record<string, any> = {
  '@bitpay-labs/crypto-wallet-core': { Web3: mockWeb3, BitcoreLib: {}, Utils: { BI: { JSONStringifyBigIntReplacer: null } } },
};

const configModulePath = path.resolve(__dirname, '../../../src/config.ts');
const MOCK_CONFIG_KEY = '__mock__/src/config';
const mockConfig = {
  maxPoolSize: 50, port: 3000, dbUrl: '', dbHost: '127.0.0.1', dbName: 'bitcore',
  dbPort: '27017', dbUser: '', dbPass: '', numWorkers: 1, chains: {},
  aliasMapping: { chains: {}, networks: {} },
  services: {
    api: { rateLimiter: { disabled: true, whitelist: [] }, wallets: {} },
    event: { onlyWalletEvents: false }, p2p: {}, socket: { bwsKeys: [] }, storage: {}
  },
  externalProviders: { alchemy: { apiKey: 'test', network: 'eth-mainnet' } }
};

require.cache[MOCK_CONFIG_KEY] = {
  id: MOCK_CONFIG_KEY, filename: MOCK_CONFIG_KEY, loaded: true,
  exports: { default: mockConfig, __esModule: true },
  parent: null, children: [], paths: [], path: ''
} as any;

Module._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (mockModules[request]) return request;
  if (request.startsWith('@bitpay-labs/')) {
    if (!mockModules[request]) {
      mockModules[request] = {};
      require.cache[request] = {
        id: request, filename: request, loaded: true, exports: mockModules[request],
        parent: null, children: [], paths: [], path: ''
      } as any;
    }
    return request;
  }
  try {
    const resolved = originalResolve.call(this, request, parent, isMain, options);
    return resolved === configModulePath ? MOCK_CONFIG_KEY : resolved;
  } catch (err) { throw err; }
};

for (const [modName, modExports] of Object.entries(mockModules)) {
  require.cache[modName] = {
    id: modName, filename: modName, loaded: true, exports: modExports,
    parent: null, children: [], paths: [], path: ''
  } as any;
}

// Now safe to import
import { AlchemyAdapter, AlchemyAssetTransferStream } from '../../../src/providers/chain-state/external/adapters/alchemy';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';

// --- Mock data ---
const VALID_TX_HASH = '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1';
const VALID_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e';
const VALID_FROM = '0x388C818CA8B9251b393131C08a736A67ccB19297';

const MOCK_TX = {
  hash: VALID_TX_HASH, blockNumber: '0x112a880', blockHash: '0xblockhash123',
  value: '0xde0b6b3a7640000', gas: '0x5208', gasPrice: '0x4a817c800',
  nonce: '0x5', to: VALID_ADDRESS, from: VALID_FROM, input: '0x', transactionIndex: '0x2a'
};
const MOCK_RECEIPT = {
  gasUsed: '0x5208', effectiveGasPrice: '0x4a817c800', status: '0x1',
  transactionHash: VALID_TX_HASH, blockNumber: '0x112a880', blockHash: '0xblockhash123'
};
const MOCK_BLOCK = { timestamp: '0x64f1f400', number: '0x112a880' };

function rpcOk(result: any) {
  return { status: 200, data: { jsonrpc: '2.0', id: 1, result } };
}

describe('AlchemyAdapter', function() {
  let sandbox: sinon.SinonSandbox;
  let adapter: AlchemyAdapter;
  let axiosPostStub: sinon.SinonStub;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    sandbox.stub(EVMTransactionStorage, 'addEffectsToTxs').callsFake(() => {});
    sandbox.stub(EVMTransactionStorage, 'abiDecode').returns(undefined as any);
    sandbox.stub(EVMTransactionStorage, '_apiTransform').callsFake((tx: any) => tx);
    axiosPostStub = sandbox.stub(axios, 'post');
    adapter = new AlchemyAdapter({ apiKey: 'test-key', network: 'eth-mainnet' });
  });

  afterEach(function() { sandbox.restore(); });
  after(function() { Module._resolveFilename = originalResolve; });

  // --- Constructor ---
  describe('constructor', function() {
    it('should throw if apiKey or network is missing', function() {
      expect(() => new AlchemyAdapter({ apiKey: '', network: 'eth-mainnet' })).to.throw('apiKey is required');
      expect(() => new AlchemyAdapter({ apiKey: 'key', network: '' })).to.throw('network is required');
    });

    it('should set name and supportedChains', function() {
      expect(adapter.name).to.equal('Alchemy');
      expect(adapter.supportedChains).to.include('ETH');
    });
  });

  // --- getTransaction ---
  describe('getTransaction', function() {
    const params = { chain: 'ETH', network: 'mainnet', chainId: '1', txId: VALID_TX_HASH };

    it('should fetch tx + receipt + block and return transformed result', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk(MOCK_TX));
      axiosPostStub.onCall(1).resolves(rpcOk(MOCK_RECEIPT));
      axiosPostStub.onCall(2).resolves(rpcOk(MOCK_BLOCK));

      const result = await adapter.getTransaction(params);
      expect(result).to.exist;
      expect(result!.txid).to.equal(VALID_TX_HASH);
      expect(result!.blockHeight).to.equal(18000000);
      expect(result!.nonce).to.equal(5);
      expect(axiosPostStub.callCount).to.equal(3);
    });

    it('should return undefined when tx not found', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk(null));
      axiosPostStub.onCall(1).resolves(rpcOk(null));
      expect(await adapter.getTransaction(params)).to.be.undefined;
    });

    it('should return undefined for pending tx (blockNumber null)', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk({ ...MOCK_TX, blockNumber: null }));
      axiosPostStub.onCall(1).resolves(rpcOk(null));
      expect(await adapter.getTransaction(params)).to.be.undefined;
    });

    it('should throw UpstreamError when receipt missing on confirmed tx', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk(MOCK_TX));
      axiosPostStub.onCall(1).resolves(rpcOk(null));
      try {
        await adapter.getTransaction(params);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(UpstreamError);
      }
    });

    it('should throw InvalidRequestError for bad txId format', async function() {
      try {
        await adapter.getTransaction({ ...params, txId: 'bad' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(InvalidRequestError);
        expect(axiosPostStub.called).to.be.false;
      }
    });

    it('should use EIP-1559 effectiveGasPrice for fee calculation', async function() {
      const eip1559Tx = { ...MOCK_TX, gasPrice: '0x77359400' }; // maxFeePerGas = 2 gwei
      const eip1559Receipt = { ...MOCK_RECEIPT, effectiveGasPrice: '0x3B9ACA00' }; // actual = 1 gwei
      axiosPostStub.onCall(0).resolves(rpcOk(eip1559Tx));
      axiosPostStub.onCall(1).resolves(rpcOk(eip1559Receipt));
      axiosPostStub.onCall(2).resolves(rpcOk(MOCK_BLOCK));

      const result = await adapter.getTransaction(params);
      // fee = gasUsed (21000) * effectiveGasPrice (1 gwei = 1000000000) = 21000000000000
      expect(result!.fee).to.equal(21000 * 1000000000);
    });
  });

  // --- Error classification (parametrized) ---
  describe('error classification via _jsonRpc', function() {
    const errorCases: Array<{ scenario: string; setup: () => void; expectedType: any }> = [
      {
        scenario: 'HTTP 401 → AuthError',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, response: { status: 401 } }),
        expectedType: AuthError
      },
      {
        scenario: 'HTTP 429 → RateLimitError',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, response: { status: 429 } }),
        expectedType: RateLimitError
      },
      {
        scenario: 'HTTP 500 → UpstreamError',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, response: { status: 500 } }),
        expectedType: UpstreamError
      },
      {
        scenario: 'timeout → TimeoutError',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, code: 'ECONNABORTED' }),
        expectedType: TimeoutError
      },
      {
        scenario: 'JSON-RPC error -32602 → InvalidRequestError',
        setup: () => axiosPostStub.resolves({ status: 200, data: { jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'invalid params' } } }),
        expectedType: InvalidRequestError
      },
      {
        scenario: 'JSON-RPC rate limit message → RateLimitError',
        setup: () => axiosPostStub.resolves({ status: 200, data: { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'rate limit exceeded' } } }),
        expectedType: RateLimitError
      },
    ];

    // Use a simple getTransaction call to exercise _jsonRpc
    const params = { chain: 'ETH', network: 'mainnet', chainId: '1', txId: VALID_TX_HASH };

    errorCases.forEach(({ scenario, setup, expectedType }) => {
      it(`should classify ${scenario}`, async function() {
        setup();
        try {
          await adapter.getTransaction(params);
          expect.fail('Should have thrown');
        } catch (err: any) {
          expect(err).to.be.instanceOf(expectedType);
        }
      });
    });
  });

  // --- Asset transfer stream ---
  describe('AlchemyAssetTransferStream', function() {
    it('should query both fromAddress and toAddress and deduplicate', async function() {
      const transfer1 = { hash: '0x1'.padEnd(66, '0'), blockNum: '0x1', from: VALID_FROM, to: VALID_ADDRESS, value: 1, category: 'external', uniqueId: 'u1', metadata: { blockTimestamp: '2023-01-01T00:00:00Z' } };
      const transfer2 = { ...transfer1, uniqueId: 'u2', hash: '0x2'.padEnd(66, '0') };
      // Same transfer appears in both directions
      axiosPostStub.onCall(0).resolves({ status: 200, data: { result: { transfers: [transfer1], pageKey: null } } });
      axiosPostStub.onCall(1).resolves({ status: 200, data: { result: { transfers: [transfer1, transfer2], pageKey: null } } });

      const stream = adapter.streamAddressTransactions({
        chain: 'ETH', network: 'mainnet', chainId: '1', address: VALID_ADDRESS,
        args: { startBlock: 0, endBlock: 100 } as any
      });

      const items: any[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (d: any) => items.push(d));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      // transfer1 appears in both responses but should be deduped
      expect(items).to.have.length(2);
    });

    it('should emit InvalidRequestError for invalid address', function(done) {
      const stream = new AlchemyAssetTransferStream(
        'https://example.com', { chain: 'ETH', network: 'mainnet', address: 'bad-address', args: {} },
        (t: any) => t
      );
      stream.on('error', (err: any) => {
        expect(err).to.be.instanceOf(InvalidRequestError);
        done();
      });
    });
  });

  // --- getBlockNumberByDate ---
  describe('getBlockNumberByDate', function() {
    it('should binary search for block closest to target date', async function() {
      // Latest block = 100
      axiosPostStub.onCall(0).resolves(rpcOk('0x64')); // eth_blockNumber = 100
      axiosPostStub.onCall(1).resolves(rpcOk({ timestamp: '0x64', number: '0x64' })); // latest block timestamp = 100

      // Target timestamp = 50 (between genesis and latest)
      // Binary search: mid=50, timestamp=50 → exact match
      axiosPostStub.onCall(2).resolves(rpcOk({ timestamp: '0x32', number: '0x32' })); // block 50, ts=50

      const result = await adapter.getBlockNumberByDate({ chainId: '1', date: new Date(50000) });
      expect(result).to.be.a('number');
    });

    it('should return latest block if target is in the future', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk('0x64'));
      axiosPostStub.onCall(1).resolves(rpcOk({ timestamp: '0x64', number: '0x64' }));

      const result = await adapter.getBlockNumberByDate({ chainId: '1', date: new Date(200000) });
      expect(result).to.equal(100);
    });
  });

  // --- healthCheck ---
  describe('healthCheck', function() {
    it('should return true on successful eth_blockNumber call', async function() {
      axiosPostStub.resolves(rpcOk('0x1'));
      expect(await adapter.healthCheck()).to.equal(true);
    });

    it('should return false on failure', async function() {
      axiosPostStub.rejects(new Error('network error'));
      expect(await adapter.healthCheck()).to.equal(false);
    });
  });
});
