import { ObjectId } from 'bson';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import { MongoBound } from '../../../../src/models/base';
import { IEVMBlock, IEVMTransactionInProcess } from '../../../../src/providers/chain-state/evm/types';
import { MATIC } from '../../../../src/modules/matic/api/csp';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';
import { mockModel } from '../../../helpers';

describe('MATIC Chain State Provider', function() {
  const chain = 'MATIC';
  const network = 'regtest';

  it('should be able to get web3', async () => {
    const sandbox = sinon.createSandbox();
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: { web3: web3Stub, rpc: sinon.stub() } } });
    const { web3 } = await MATIC.getWeb3(network);
    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.eq(2);
    expect(block).to.eq(1);
    sandbox.restore();
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const sandbox = sinon.createSandbox();
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().throws('Block number fails') } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: { web3: web3Stub, rpc: sinon.stub() } } });
    const { web3 } = await MATIC.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.not.exist;
    sandbox.restore();
  });

  it('should get ERC20 information', async () => {
    const sandbox = sinon.createSandbox();
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
    sandbox.stub(MATIC, 'erc20For').resolves(tokenStub);
    const token = await MATIC.getERC20TokenInfo(network, '0x123');
    expect(token.name).to.eq(expected.name);
    expect(token.symbol).to.eq(expected.symbol);
    expect(token.decimals).to.eq(expected.decimals);
    sandbox.restore();
  });

  it('should be able to find an MATIC transaction', async () => {
    const sandbox = sinon.createSandbox();
    const mockTx = {
      _id: new ObjectId(),
      chain: 'MATIC', 
      network: 'testnet',
      txid: '123',
      blockHeight: 1,
      gasPrice: 10,
      data: Buffer.from('')
    } as MongoBound<IEVMTransactionInProcess>;
    sandbox.stub(MATIC, 'getReceipt').resolves({ gasUsed: 21000 });
    sandbox.stub(MATIC, 'getLocalTip').resolves({ height: 1 });
    mockModel('transactions', mockTx);
    const found = await MATIC.getTransaction({ chain: 'MATIC', network: 'testnet', txId: '123' });
    expect(found).to.exist;
    expect(found!.fee).to.eq(21000 * 10);
    expect(found!.confirmations).to.eq(1);
    sandbox.restore();
  });

  it('should be able to broadcast an array of txs', async () => {
    const sandbox = sinon.createSandbox();
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: { web3: web3Stub, rpc: sinon.stub() } } });
    const txids = await MATIC.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('456')).to.eq(true);
    expect(txids).to.deep.eq(['123', '456']);
    sandbox.restore();
  });

  it('should be able to broadcast a single tx', async () => {
    const sandbox = sinon.createSandbox();
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: { web3: web3Stub, rpc: sinon.stub() } } });
    const txid = await MATIC.broadcastTransaction({ chain, network, rawTx: '123' });
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(txid).to.eq('123');
    sandbox.restore();
  });

  it('should stop broadcasting txs on error', async () => {
    const sandbox = sinon.createSandbox();
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: { web3: web3Stub, rpc: sinon.stub() } } });
    let thrown = false;
    try {
      await MATIC.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    } catch (e) {
      thrown = true;
    }
    expect(thrown).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('123')).to.eq(true);
    expect(web3Stub.eth.sendSignedTransaction.calledWith('456')).to.eq(false);
    sandbox.restore();
  });

  it('should be able to find an MATIC block', async () => {
    const sandbox = sinon.createSandbox();
    const mockBlock = {
      _id: new ObjectId(),
      hash: '55555',
      height: 1
    } as MongoBound<IEVMBlock>;
    mockModel('blocks', mockBlock);
    const found = await MATIC.getBlocks({ chain, network, blockId: mockBlock.hash });
    expect(found).to.exist;
    expect(found[0]).to.exist;
    expect(found[0].hash).to.eq(mockBlock.hash);
    expect(found[0].height).to.eq(mockBlock.height);
    sandbox.restore();
  });

  describe('estimateGas', () => {
    const sandbox = sinon.createSandbox();
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

    beforeEach(() => {
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: { web3: web3Stub, rpc: sinon.stub() } } });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('it should return gas', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { result: '12345' });
      const gas = await MATIC.estimateGas({ network, to: '0x123', from: '0xabc', gasPrice: 123, value: 'lorem' });
      expect(gas).to.equal(12345);
    });

    it('should return gas for optional params', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { result: '1234' });
      
      const gas = await MATIC.estimateGas({ network });
      expect(gas).to.equal(1234);
    });

    it('should reject an error response', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, 'Unavailable server', null); // body is null
  
      try {
        await MATIC.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.equal('Unavailable server');
      }
    });

    it('should reject if response body is missing result', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { message: 'need some param' });
  
      try {
        await MATIC.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.deep.equal({ message: 'need some param' });
      }
    });

    it('should reject if response body is missing result and has error', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { error: { code: 2, message: 'need some param' } });
  
      try {
        await MATIC.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.deep.equal({ code: 2, message: 'need some param' });
      }
    });

    it('should reject on unexpected error', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { result: '12345' });
  
      try {
        await MATIC.estimateGas({ network: 'unexpected' });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Cannot read properties of undefined (reading \'providers\')');
      }
    });

    it('should reject on unexpected error in callback', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, null); // body is null
  
      try {
        await MATIC.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Cannot read properties of null (reading \'result\')');
      }
    });
  });
});
