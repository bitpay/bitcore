import { ObjectId } from 'bson';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import { MongoBound } from '../../../../src/models/base';
import { ETH, ETHStateProvider } from '../../../../src/modules/ethereum/api/csp';
import { IEthBlock, IEthTransaction } from '../../../../src/modules/ethereum/types';
import { mockModel } from '../../../helpers';

describe('ETH Chain State Provider', function() {
  it('should be able to get web3', async () => {
    const sandbox = sinon.createSandbox();
    const network = 'testnet';
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
    sandbox.stub(ETHStateProvider, 'rpcs').value({ [network]: { web3: web3Stub, rpc: sinon.stub() } });
    const { web3 } = await ETH.getWeb3(network);
    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.eq(2);
    expect(block).to.eq(1);
    sandbox.restore();
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const sandbox = sinon.createSandbox();
    const network = 'testnet';
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().throws('Block number fails') } };
    sandbox.stub(ETHStateProvider, 'rpcs').value({ [network]: { web3: web3Stub, rpc: sinon.stub() } });
    const { web3 } = await ETH.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.not.exist;
    sandbox.restore();
  });

  it('should get ERC20 information', async () => {
    const sandbox = sinon.createSandbox();
    const network = 'testnet';
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
    sandbox.restore();
  });

  it('should be able to find an ETH transaction', async () => {
    const sandbox = sinon.createSandbox();
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
    const found = await ETH.getTransaction({ chain: 'ETH', network: 'testnet', txId: '123' });
    expect(found).to.exist;
    expect(found!.fee).to.eq(21000 * 10);
    expect(found!.confirmations).to.eq(1);
    sandbox.restore();
  });

  it('should be able to broadcast an array of txs', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'ETH';
    const network = 'testnet';
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
    sandbox.stub(ETHStateProvider, 'rpcs').value({ [network]: { web3: web3Stub, rpc: sinon.stub() } });
    const txids = await ETH.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('456')).to.eq(true);
    expect(txids).to.deep.eq(['123', '456']);
    sandbox.restore();
  });

  it('should be able to broadcast a single tx', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'ETH';
    const network = 'testnet';
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
    sandbox.stub(ETHStateProvider, 'rpcs').value({ [network]: { web3: web3Stub, rpc: sinon.stub() } });
    const txid = await ETH.broadcastTransaction({ chain, network, rawTx: '123' });
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(txid).to.eq('123');
    sandbox.restore();
  });

  it('should stop broadcasting txs on error', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'ETH';
    const network = 'testnet';
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
    sandbox.stub(ETHStateProvider, 'rpcs').value({ [network]: { web3: web3Stub, rpc: sinon.stub() } });
    let thrown = false;
    try {
      await ETH.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    } catch (e) {
      thrown = true;
    }
    expect(thrown).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('456')).to.eq(false);
    sandbox.restore();
  });

  it('should be able to find an ETH block', async () => {
    const sandbox = sinon.createSandbox();
    const mockBlock = {
      _id: new ObjectId(),
      hash: '55555',
      height: 1
    } as MongoBound<IEthBlock>;
    mockModel('blocks', mockBlock);
    const found = await ETH.getBlocks({ chain: 'ETH', network: 'testnet', blockId: mockBlock.hash });
    expect(found).to.exist;
    expect(found[0]).to.exist;
    expect(found[0].hash).to.eq(mockBlock.hash);
    expect(found[0].height).to.eq(mockBlock.height);
    sandbox.restore();
  });
});
