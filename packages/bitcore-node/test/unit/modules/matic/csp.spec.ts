import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'assert';
import { ObjectId } from 'bson';
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
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  it('should be able to get web3', async () => {
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await MATIC.getWeb3(network);
    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    assert.strictEqual(stub.callCount, 2);
    assert.strictEqual(block, 1);
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().rejects('Block number fails') } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await MATIC.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    assert.equal(stub.callCount, null, 'stub.callCount should not exist');
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
    sandbox.stub(MATIC, 'erc20For').resolves(tokenStub);
    const token = await MATIC.getERC20TokenInfo(network, '0x123');
    assert.strictEqual(token.name, expected.name);
    assert.strictEqual(token.symbol, expected.symbol);
    assert.strictEqual(token.decimals, expected.decimals);
  });

  it('should be able to find an MATIC transaction', async () => {
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
    assert.notEqual(found, null);
    assert.strictEqual(found!.fee, 21000 * 10);
    assert.strictEqual(found!.confirmations, 1);
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const txids = await MATIC.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    assert.strictEqual(web3Stub.eth.sendSignedTransaction.calledWith('123'), true);
    assert.strictEqual(web3Stub.eth.sendSignedTransaction.calledWith('456'), true);
    assert.deepEqual(txids, ['123', '456']);
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const txid = await MATIC.broadcastTransaction({ chain, network, rawTx: '123' });
    assert.strictEqual(web3Stub.eth.sendSignedTransaction.calledWith('123'), true);
    assert.strictEqual(txid, '123');
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    let thrown = false;
    try {
      await MATIC.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
    } catch (e) {
      thrown = true;
    }
    assert.strictEqual(thrown, true);
    assert.strictEqual(web3Stub.eth.sendSignedTransaction.calledWith('123'), true);
    assert.strictEqual(web3Stub.eth.sendSignedTransaction.calledWith('456'), false);
  });

  it('should be able to find an MATIC block', async () => {
    const mockBlock = {
      _id: new ObjectId(),
      hash: '55555',
      height: 1
    } as MongoBound<IEVMBlock>;
    mockModel('blocks', mockBlock);
    const found = await MATIC.getBlocks({ chain, network, blockId: mockBlock.hash });
    assert.notEqual(found, null, 'found should exist');
    assert.notEqual(found[0], null, 'found[0] should exist');
    assert.strictEqual(found[0].hash, mockBlock.hash);
    assert.strictEqual(found[0].height, mockBlock.height);
  });

  describe('estimateGas', () => {
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
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ MATIC: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    });

    it('it should return gas', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { result: '12345' });
      const gas = await MATIC.estimateGas({ network, to: '0x123', from: '0xabc', gasPrice: 123, value: 'lorem' });
      assert.strictEqual(gas, 12345);
    });

    it('should return gas for optional params', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { result: '1234' });
      const gas = await MATIC.estimateGas({ network });
      assert.strictEqual(gas, 1234);
    });

    it('should reject an error response', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, 'Unavailable server', null); // body is null
      assert.rejects(async () => await MATIC.estimateGas({ network }), (e) => e === 'Unavailable server');
    });

    it('should reject if response body is missing result', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { message: 'need some param' });
      assert.rejects(async () => await MATIC.estimateGas({ network }), { message: 'need some param' });
    });

    it('should reject if response body is missing result and has error', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { error: { code: 2, message: 'need some param' } });
      assert.rejects(async () => await MATIC.estimateGas({ network }), { code: 2, message: 'need some param' });
    });

    it('should reject on unexpected error', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, { result: '12345' });
      assert.rejects(async () => await MATIC.estimateGas({ network: 'unexpected' }), { message: 'No configuration found for unexpected and "realtime" compatible dataType' });
    });

    it('should reject on unexpected error in callback', async () => {
      web3Stub.currentProvider.send.callsArgWith(1, null, null); // body is null
      assert.rejects(async () => await MATIC.estimateGas({ network }), { message: 'Cannot read properties of null (reading \'result\')' });
    });
  });
});
