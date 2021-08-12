import { ObjectId } from 'bson';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import config from '../../../../src/config';
import { MongoBound } from '../../../../src/models/base';
import { ETH, ETHStateProvider } from '../../../../src/modules/ethereum/api/csp';
import { EthPool } from '../../../../src/modules/ethereum/p2p/EthPool';
import { IEthBlock, IEthTransaction } from '../../../../src/modules/ethereum/types';
import { mockModel } from '../../../helpers';

describe('ETH Chain State Provider', () => {
  const sandbox = sinon.createSandbox();
  const chain = 'ETH';
  const network = 'testnet';
  const defaultPoolConfig = config.chains[chain];

  beforeEach(() => {
    sandbox.stub(ETHStateProvider, 'rpcs').value({
      [network]: new EthPool(chain, network, defaultPoolConfig)
    });
  });

  afterEach(() => sandbox.restore());

  // Helpers
  const stubWeb3Connections = (web3Stub) =>
    ETHStateProvider.rpcs[network].getRpcs().forEach(provider => {
      const { web3 } = provider;
      sandbox.stub(web3, 'eth').value({
        ...web3.eth,
        ...web3Stub.eth,
      });
    });

  // Tests
  it('should be able to get web3', async () => {
    const { web3 } = await ETH.getWeb3(network);
    sandbox.stub(web3, 'eth').value({ getBlockNumber: sandbox.stub().resolves(1) });

    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.eq(1);
    expect(block).to.eq(1);
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const { web3 } = await ETH.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.not.exist;
  });

  it('should get ERC20 information', async () => {
    const expected = {
      name: 'Test Token',
      decimals: 10,
      symbol: 'TST'
    };
    const tokenStub = {
      methods: {
        name: () => ({ call: sandbox.stub().resolves(expected.name) }),
        decimals: () => ({ call: sandbox.stub().resolves(expected.decimals) }),
        symbol: () => ({ call: sandbox.stub().resolves(expected.symbol) })
      }
    };
    sandbox.stub(ETH, 'erc20For').resolves(tokenStub);
    const token = await ETH.getERC20TokenInfo(network, '0x123');
    expect(token.name).to.eq(expected.name);
    expect(token.symbol).to.eq(expected.symbol);
    expect(token.decimals).to.eq(expected.decimals);
  });

  it('should be able to find an ETH transaction', async () => {
    const mockTx = {
      _id: new ObjectId(),
      txid: '123',
      blockHeight: 1,
      gasPrice: 10,
      data: Buffer.from('')
    } as MongoBound<IEthTransaction>;
    sandbox.stub(ETH, 'getReceipt').resolves({ gasUsed: 21000 });
    sandbox.stub(ETH, 'getLocalTip').resolves({ height: 1 });
    mockModel('transactions', mockTx);
    const found = await ETH.getTransaction({ chain, network, txId: '123' });
    expect(found).to.exist;
    expect(found!.fee).to.eq(21000 * 10);
    expect(found!.confirmations).to.eq(1);
  });

  it('should be able to broadcast an array of txs', async () => {
    const web3Stub = {
      eth: {
        getBlockNumber: sandbox.stub().resolves(1),
        sendSignedTransaction: sandbox.stub().callsFake(tx => {
          const emitter = new EventEmitter();
          (emitter as any).catch = sandbox.stub().returnsThis();
          setTimeout(() => {
            emitter.emit('transactionHash', tx);
          }, 10);
          return emitter;
        })
      }
    };

    stubWeb3Connections(web3Stub);
    const txids = await ETH.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('456')).to.eq(true);
    expect(txids).to.deep.eq(['123', '456']);
  });

  it('should be able to broadcast a single tx', async () => {
    const web3Stub = {
      eth: {
        getBlockNumber: sandbox.stub().resolves(1),
        sendSignedTransaction: sandbox.stub().callsFake((tx) => {
          const emitter = new EventEmitter();
          (emitter as any).catch = sandbox.stub().returnsThis();
          setTimeout(() => {
            emitter.emit('transactionHash', tx);
          }, 10);
          return emitter;
        })
      }
    };

    stubWeb3Connections(web3Stub);
    const txid = await ETH.broadcastTransaction({ chain, network, rawTx: '123' });
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(txid).to.eq('123');
  });

  it('should stop broadcasting txs on error', async () => {
    let shouldThrow = false;
    const web3Stub = {
      eth: {
        getBlockNumber: sandbox.stub().resolves(1),
        sendSignedTransaction: sandbox.stub().callsFake(() => {
          const emitter = new EventEmitter();
          const err = new Error('fake error');
          (emitter as any).catch = cb => cb(err);
          if (!shouldThrow) {
            setTimeout(() => {
              emitter.emit('transactionHash');
            }, 10);
            shouldThrow = true;
          } else {
            setTimeout(() => {
              emitter.emit('error', err);
            }, 10);
          }
          return emitter;
        })
      }
    };

    stubWeb3Connections(web3Stub);
    let thrown = false;
    try {
      await ETH.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    } catch (e) {
      thrown = true;
    }
    expect(thrown).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('456')).to.eq(false);
  });

  it('should be able to find an ETH block', async () => {
    const mockBlock = {
      _id: new ObjectId(),
      hash: '55555',
      height: 1
    } as MongoBound<IEthBlock>;
    mockModel('blocks', mockBlock);
    const found = await ETH.getBlocks({ chain, network, blockId: mockBlock.hash });
    expect(found).to.exist;
    expect(found[0]).to.exist;
    expect(found[0].hash).to.eq(mockBlock.hash);
    expect(found[0].height).to.eq(mockBlock.height);
  });

  describe('estimateGas', () => {
    const sandbox = sinon.createSandbox();
    const network = 'testnet';
    const web3Stub: any = {
      utils: {
        toHex: (val) => val && Buffer.from(val.toString()).toString('hex')
      },
      eth: {
        getBlockNumber: sandbox.stub().resolves(1)
      },
      currentProvider: {
        send: sandbox.stub()
      }
    };
    let provider;

    beforeEach(async () => {
      sandbox.stub(ETHStateProvider, 'rpcs').value({
        [network]: new EthPool(chain, network, defaultPoolConfig)
      });

      // Stub all available web3 providers and assign local provider
      ETHStateProvider.rpcs[network].getRpcs().forEach(_provider => {
        const { web3 } = _provider;
        provider = web3.currentProvider as any;
        sandbox.stub(provider,'send').value(web3Stub.currentProvider.send);
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('it should return gas', async () => {
      provider.send.callsArgWith(1, null, { result: '12345' });
      const gas = await ETH.estimateGas({ network, to: '0x123', from: '0xabc', gasPrice: 123, value: 'lorem' });
      expect(gas).to.equal(12345);
    });

    it('should return gas for optional params', async () => {
      provider.send.callsArgWith(1, null, { result: '1234' });
      const gas = await ETH.estimateGas({ network });
      expect(gas).to.equal(1234);
    });

    it('should reject an error response', async () => {
      provider.send.callsArgWith(1, 'Unavailable server', null); // body is null

      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.equal('Unavailable server');
      }
    });

    it('should reject if response body is missing result', async () => {
      provider.send.callsArgWith(1, null, { message: 'need some param' });

      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.equal('need some param');
      }
    });

    it('should reject on unexpected error', async () => {
      provider.send.callsArgWith(1, null, { result: '12345' });

      try {
        await ETH.estimateGas({ network: 'unexpected' });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot read property \'trustedPeers\' of undefined');
      }
    });

    it('should reject on unexpected error in callback', async () => {
      provider.send.callsArgWith(1, null, null); // body is null

      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot read property \'result\' of null');
      }
    });
  });
});
