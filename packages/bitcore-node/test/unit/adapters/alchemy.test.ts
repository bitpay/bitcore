import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import path from 'path';
import { AdapterError, AdapterErrorCode } from '../../../src/providers/chain-state/external/adapters/errors';

// --- Module mocks (must run before AlchemyAdapter import) ---
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
  externalProviders: { alchemy: { apiKey: 'test-key' } }
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
    adapter = new AlchemyAdapter({ name: 'alchemy', priority: 1 });
  });

  afterEach(function() { sandbox.restore(); });
  after(function() { Module._resolveFilename = originalResolve; });

  // --- Constructor ---
  describe('constructor', function() {
    it('should throw if apiKey is missing from config', function() {
      const saved = mockConfig.externalProviders;
      mockConfig.externalProviders = { alchemy: { apiKey: '' } } as any;
      expect(() => new AlchemyAdapter({ name: 'alchemy', priority: 1 })).to.throw('apiKey is required');
      mockConfig.externalProviders = saved;
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

    it('should throw UPSTREAM error when receipt missing on confirmed tx', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk(MOCK_TX));
      axiosPostStub.onCall(1).resolves(rpcOk(null));
      try {
        await adapter.getTransaction(params);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(AdapterError);
        expect(err.code).to.equal(AdapterErrorCode.UPSTREAM);
      }
    });

    it('should throw INVALID_REQUEST for bad txId format', async function() {
      try {
        await adapter.getTransaction({ ...params, txId: 'bad' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(AdapterError);
        expect(err.code).to.equal(AdapterErrorCode.INVALID_REQUEST);
        expect(axiosPostStub.called).to.be.false;
      }
    });

    it('should throw INVALID_REQUEST for unsupported chain/network', async function() {
      try {
        await adapter.getTransaction({ ...params, chain: 'BTC', network: 'mainnet' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(AdapterError);
        expect(err.code).to.equal(AdapterErrorCode.INVALID_REQUEST);
        expect(err.message).to.include('unsupported');
      }
    });

    it('should use EIP-1559 effectiveGasPrice for fee calculation', async function() {
      const eip1559Tx = { ...MOCK_TX, gasPrice: '0x77359400' };
      const eip1559Receipt = { ...MOCK_RECEIPT, effectiveGasPrice: '0x3B9ACA00' };
      axiosPostStub.onCall(0).resolves(rpcOk(eip1559Tx));
      axiosPostStub.onCall(1).resolves(rpcOk(eip1559Receipt));
      axiosPostStub.onCall(2).resolves(rpcOk(MOCK_BLOCK));

      const result = await adapter.getTransaction(params);
      expect(result!.fee).to.equal(21000 * 1000000000);
    });
  });

  // --- Error classification ---
  describe('error classification via _jsonRpc', function() {
    const errorCases: Array<{ scenario: string; setup: () => void; expectedCode: AdapterErrorCode }> = [
      {
        scenario: 'HTTP 401 → AUTH',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, response: { status: 401 } }),
        expectedCode: AdapterErrorCode.AUTH
      },
      {
        scenario: 'HTTP 429 → RATE_LIMIT',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, response: { status: 429 } }),
        expectedCode: AdapterErrorCode.RATE_LIMIT
      },
      {
        scenario: 'HTTP 500 → UPSTREAM',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, response: { status: 500 } }),
        expectedCode: AdapterErrorCode.UPSTREAM
      },
      {
        scenario: 'timeout → TIMEOUT',
        setup: () => axiosPostStub.rejects({ isAxiosError: true, code: 'ECONNABORTED' }),
        expectedCode: AdapterErrorCode.TIMEOUT
      },
      {
        scenario: 'JSON-RPC error -32602 → INVALID_REQUEST',
        setup: () => axiosPostStub.resolves({ status: 200, data: { jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'invalid params' } } }),
        expectedCode: AdapterErrorCode.INVALID_REQUEST
      },
      {
        scenario: 'JSON-RPC rate limit message → RATE_LIMIT',
        setup: () => axiosPostStub.resolves({ status: 200, data: { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'rate limit exceeded' } } }),
        expectedCode: AdapterErrorCode.RATE_LIMIT
      },
    ];

    const params = { chain: 'ETH', network: 'mainnet', chainId: '1', txId: VALID_TX_HASH };

    errorCases.forEach(({ scenario, setup, expectedCode }) => {
      it(`should classify ${scenario}`, async function() {
        setup();
        try {
          await adapter.getTransaction(params);
          expect.fail('Should have thrown');
        } catch (err: any) {
          expect(err).to.be.instanceOf(AdapterError);
          expect(err.code).to.equal(expectedCode);
        }
      });
    });
  });

  // --- Asset transfer stream ---
  describe('AlchemyAssetTransferStream', function() {
    it('should query both fromAddress and toAddress and deduplicate', async function() {
      const transfer1 = { hash: '0x1'.padEnd(66, '0'), blockNum: '0x1', from: VALID_FROM, to: VALID_ADDRESS, value: 1, category: 'external', uniqueId: 'u1', metadata: { blockTimestamp: '2023-01-01T00:00:00Z' } };
      const transfer2 = { ...transfer1, uniqueId: 'u2', hash: '0x2'.padEnd(66, '0') };
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

      expect(items).to.have.length(2);
    });

    it('should emit INVALID_REQUEST error for invalid address', function(done) {
      const stream = new AlchemyAssetTransferStream(
        'https://example.com', { chain: 'ETH', network: 'mainnet', address: 'bad-address', args: {} },
        (t: any) => t
      );
      stream.on('error', (err: any) => {
        expect(err).to.be.instanceOf(AdapterError);
        expect(err.code).to.equal(AdapterErrorCode.INVALID_REQUEST);
        done();
      });
    });
  });

  // --- getBlockNumberByDate ---
  describe('getBlockNumberByDate', function() {
    it('should binary search for block closest to target date', async function() {
      axiosPostStub.callsFake(async (_url: string, body: any) => {
        if (body.method === 'eth_blockNumber') return rpcOk('0x64');
        if (body.method === 'eth_getBlockByNumber') {
          const num = parseInt(body.params[0], 16);
          return rpcOk({ timestamp: `0x${num.toString(16)}`, number: body.params[0] });
        }
        return rpcOk(null);
      });

      const result = await adapter.getBlockNumberByDate({ chain: 'ETH', network: 'mainnet', chainId: '1', date: new Date(50000) });
      expect(result).to.equal(50);
    });

    it('should return latest block if target is in the future', async function() {
      axiosPostStub.onCall(0).resolves(rpcOk('0x64'));
      axiosPostStub.onCall(1).resolves(rpcOk({ timestamp: '0x64', number: '0x64' }));

      const result = await adapter.getBlockNumberByDate({ chain: 'ETH', network: 'mainnet', chainId: '1', date: new Date(200000) });
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
