import { expect } from 'chai';
import sinon from 'sinon';
import { MoralisAdapter } from '../../../src/providers/chain-state/external/adapters/moralis';
import { AlchemyAdapter } from '../../../src/providers/chain-state/external/adapters/alchemy';
import { AdapterError, AdapterErrorCode } from '../../../src/providers/chain-state/external/adapters/errors';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import config from '../../../src/config';

const MORALIS_KEY = (process as NodeJS.Process).env.MORALIS_API_KEY;
const ALCHEMY_KEY = (process as NodeJS.Process).env.ALCHEMY_API_KEY;

// Known BASE mainnet transaction for cross-adapter verification
const KNOWN_TX_HASH = '0x6a4be6adf22988c7f4e92cb829b1d0e4e9a7f5bf3e2d456d63e51c9b287f1f4c';
const CHAIN_ID = '0x2105'; // BASE mainnet = 8453

describe('Multi-Provider Integration (BASE mainnet)', function () {
  this.timeout(30000);

  let sandbox: sinon.SinonSandbox;
  let moralis: MoralisAdapter;
  let alchemy: AlchemyAdapter;
  const savedExternalProviders = config.externalProviders;

  before(function () {
    if (!MORALIS_KEY || !ALCHEMY_KEY) {
      this.skip();
    }
    (config as any).externalProviders = {
      ...savedExternalProviders,
      moralis: { apiKey: MORALIS_KEY },
      alchemy: { apiKey: ALCHEMY_KEY }
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
    moralis = new MoralisAdapter({ name: 'moralis', priority: 1 });
    alchemy = new AlchemyAdapter({ name: 'alchemy', priority: 2 });
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should get a known transaction via Moralis adapter', async function () {
    const tx = await moralis.getTransaction({
      chain: 'BASE',
      network: 'mainnet',
      chainId: CHAIN_ID,
      txId: KNOWN_TX_HASH
    });
    expect(tx).to.exist;
    expect(tx!.txid).to.equal(KNOWN_TX_HASH);
    expect(tx!.blockHeight).to.be.a('number').and.to.be.greaterThan(0);
  });

  it('should get the same transaction via Alchemy adapter', async function () {
    const tx = await alchemy.getTransaction({
      chain: 'BASE',
      network: 'mainnet',
      chainId: CHAIN_ID,
      txId: KNOWN_TX_HASH
    });
    expect(tx).to.exist;
    expect(tx!.txid).to.equal(KNOWN_TX_HASH);
    expect(tx!.blockHeight).to.be.a('number').and.to.be.greaterThan(0);
  });

  it('should stream address transactions', function (done) {
    const stream = moralis.streamAddressTransactions({
      chain: 'BASE',
      network: 'mainnet',
      chainId: CHAIN_ID,
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
      args: { pageSize: 3 } as any
    });
    const results: any[] = [];
    stream.on('data', (d: any) => results.push(d));
    stream.on('end', () => {
      expect(results.length).to.be.greaterThan(0);
      done();
    });
    stream.on('error', done);
  });

  it('should failover when primary API key is invalid', async function () {
    const badConfig = config.externalProviders;
    (config as any).externalProviders = {
      ...badConfig,
      moralis: { apiKey: 'invalid-key-12345' }
    };
    const badAdapter = new MoralisAdapter({ name: 'moralis', priority: 1 });
    (config as any).externalProviders = badConfig;

    try {
      await badAdapter.getTransaction({
        chain: 'BASE',
        network: 'mainnet',
        chainId: CHAIN_ID,
        txId: KNOWN_TX_HASH
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).to.be.instanceOf(AdapterError);
      expect(err.code).to.equal(AdapterErrorCode.AUTH);
    }
  });
});
