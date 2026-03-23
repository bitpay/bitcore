import { ObjectId } from 'bson';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import * as aaveApi from '../../../../src/providers/chain-state/evm/api/aave';
import { MongoBound } from '../../../../src/models/base';
import { ETH } from '../../../../src/modules/ethereum/api/csp';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';
import { IEVMBlock, IEVMTransactionInProcess } from '../../../../src/providers/chain-state/evm/types';
import { mockModel } from '../../../helpers';

describe('ETH Chain State Provider', function() {
  const chain = 'ETH';
  const network = 'regtest';

  it('should be able to get web3', async () => {
    const sandbox = sinon.createSandbox();
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await ETH.getWeb3(network);
    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.eq(1);
    expect(block).to.eq(1);
    sandbox.restore();
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const sandbox = sinon.createSandbox();
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().throws('Block number fails') } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await ETH.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.equal(0);
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
      chain: 'ETH', 
      network: 'testnet',
      txid: '123',
      blockHeight: 1,
      gasPrice: 10,
      data: Buffer.from('')
    } as MongoBound<IEVMTransactionInProcess>;
    const mockBlock = {
      _id: new ObjectId(),
      chain: 'ETH', 
      network: 'testnet',
      hash: '55555',
      height: 1,
      processed: true
    } as MongoBound<IEVMBlock>;
    mockModel('blocks', mockBlock);
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const txids = await ETH.broadcastTransaction({ chain, network, rawTx: ['123', '456'] });
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const txid = await ETH.broadcastTransaction({ chain, network, rawTx: '123' });
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
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
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

  it('should return expected fields for Aave v3 account data', async () => {
    const sandbox = sinon.createSandbox();
    const accountData = {
      totalCollateralBase: 0n,
      totalDebtBase: 0n,
      availableBorrowsBase: 0n,
      currentLiquidationThreshold: 8600n,
      ltv: 8250n,
      healthFactor: 123456n
    };

    const contractStub = {
      methods: {
        getUserAccountData: () => ({ call: sandbox.stub().resolves(accountData) })
      }
    };

    const web3Stub: any = {
      utils: { toChecksumAddress: (addr: string) => addr },
      eth: { Contract: sandbox.stub().returns(contractStub) }
    };

    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({
      [`ETH:${network}`]: {
        realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }]
      }
    });
    sandbox.stub(aaveApi, 'getAavePoolAddress').returns('0xpool');

    const result = await ETH.getAaveUserAccountData({
      network,
      address: '0x123',
      version: 'v3'
    });

    expect(result).to.deep.include({
      totalCollateralBase: '0',
      totalDebtBase: '0',
      availableBorrowsBase: '0',
      currentLiquidationThreshold: '8600',
      ltv: '8250',
      healthFactor: '123456'
    });
    sandbox.restore();
  });

  it('should return expected fields for Aave v2 account data', async () => {
    const sandbox = sinon.createSandbox();
    const accountData = {
      totalCollateralETH: 10n,
      totalDebtETH: 2n,
      availableBorrowsETH: 8n,
      currentLiquidationThreshold: 8600n,
      ltv: 8250n,
      healthFactor: 999n
    };

    const contractStub = {
      methods: {
        getUserAccountData: () => ({ call: sandbox.stub().resolves(accountData) })
      }
    };

    const web3Stub: any = {
      utils: { toChecksumAddress: (addr: string) => addr },
      eth: { Contract: sandbox.stub().returns(contractStub) }
    };

    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({
      [`ETH:${network}`]: {
        realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }]
      }
    });
    sandbox.stub(aaveApi, 'getAavePoolAddress').returns('0xpool');

    const result = await ETH.getAaveUserAccountData({
      network,
      address: '0x123',
      version: 'v2'
    });

    expect(result).to.deep.include({
      totalCollateralETH: '10',
      totalDebtETH: '2',
      availableBorrowsETH: '8',
      currentLiquidationThreshold: '8600',
      ltv: '8250',
      healthFactor: '999'
    });
    sandbox.restore();
  });

  describe('getAaveReserveData', function() {
    // Using USDC as a common asset for both v2 and v3 tests
    const asset = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    const makeReserveDataStub = (sandbox: sinon.SinonSandbox) => {
      const reserveData = {
        currentVariableBorrowRate: 80000000000000000000000000n
      };
      const contractStub = {
        methods: { getReserveData: () => ({ call: sandbox.stub().resolves(reserveData) }) }
      };
      const web3Stub: any = {
        utils: { toChecksumAddress: (addr: string) => addr },
        eth: { Contract: sandbox.stub().returns(contractStub) }
      };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({
        [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] }
      });
      sandbox.stub(aaveApi, 'getAavePoolAddress').returns('0xpool');
      return reserveData;
    };

    it('should return currentVariableBorrowRate for Aave v3', async () => {
      const sandbox = sinon.createSandbox();
      makeReserveDataStub(sandbox);

      const result = await ETH.getAaveReserveData({ network, asset, version: 'v3' });

      expect(result).to.deep.equal({ currentVariableBorrowRate: '80000000000000000000000000' });
      sandbox.restore();
    });

    it('should return currentVariableBorrowRate for Aave v2', async () => {
      const sandbox = sinon.createSandbox();
      makeReserveDataStub(sandbox);

      const result = await ETH.getAaveReserveData({ network, asset, version: 'v2' });

      expect(result).to.deep.equal({ currentVariableBorrowRate: '80000000000000000000000000' });
      sandbox.restore();
    });
  });

  describe('getAaveReserveTokensAddresses', function() {
    it('should return variableDebtTokenAddress', async () => {
      const sandbox = sinon.createSandbox();
      const reserveData = {
        variableDebtTokenAddress: '0xvariableDebtAddress'
      };
      const contractStub = {
        methods: { getReserveData: () => ({ call: sandbox.stub().resolves(reserveData) }) }
      };
      const web3Stub: any = {
        utils: { toChecksumAddress: (addr: string) => addr },
        eth: { Contract: sandbox.stub().returns(contractStub) }
      };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({
        [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] }
      });
      sandbox.stub(aaveApi, 'getAavePoolAddress').returns('0xpool');

      const result = await ETH.getAaveReserveTokensAddresses({
        network,
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        version: 'v3'
      });

      expect(result).to.deep.equal({ variableDebtTokenAddress: '0xvariableDebtAddress' });
      sandbox.restore();
    });

    it('should return variableDebtTokenAddress for v2', async () => {
      const sandbox = sinon.createSandbox();
      const reserveData = {
        variableDebtTokenAddress: '0xvariableDebtAddress'
      };
      const contractStub = {
        methods: { getReserveData: () => ({ call: sandbox.stub().resolves(reserveData) }) }
      };
      const web3Stub: any = {
        utils: { toChecksumAddress: (addr: string) => addr },
        eth: { Contract: sandbox.stub().returns(contractStub) }
      };
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({
        [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] }
      });
      sandbox.stub(aaveApi, 'getAavePoolAddress').returns('0xpool');

      const result = await ETH.getAaveReserveTokensAddresses({
        network,
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        version: 'v2'
      });

      expect(result).to.deep.equal({ variableDebtTokenAddress: '0xvariableDebtAddress' });
      sandbox.restore();
    });
  });

  it('should be able to find an ETH block', async () => {
    const sandbox = sinon.createSandbox();
    const mockBlock = {
      _id: new ObjectId(),
      hash: '55555',
      height: 1
    } as MongoBound<IEVMBlock>;
    mockModel('blocks', mockBlock);
    const found = await ETH.getBlocks({ chain, network, blockId: mockBlock.hash });
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
        request: sandbox.stub()
      }
    };

    beforeEach(() => {
      sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ [`ETH:${network}`]: { realtime: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('it should return gas', async () => {
      web3Stub.currentProvider.request.resolves({ result: '12345' });
      const gas = await ETH.estimateGas({ network, to: '0x123', from: '0xabc', gasPrice: 123, value: 'lorem' });
      expect(gas).to.equal(12345);
    });

    it('should return gas for optional params', async () => {
      web3Stub.currentProvider.request.resolves({ result: '1234' });
      
      const gas = await ETH.estimateGas({ network });
      expect(gas).to.equal(1234);
    });

    it('should reject an error response', async () => {
      web3Stub.currentProvider.request.rejects(new Error('Unavailable server')); // body is null
  
      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Unavailable server');
      }
    });

    it('should reject if response body is missing result', async () => {
      web3Stub.currentProvider.request.resolves({ message: 'need some param' });
  
      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal(JSON.stringify({ message: 'need some param' }));
      }
    });

    it('should reject if response body is missing result and has error', async () => {
      web3Stub.currentProvider.request.resolves({ error: { code: 2, message: 'need some param' } });
  
      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal(JSON.stringify({ code: 2, message: 'need some param' }));
      }
    });

    it('should reject on unexpected error', async () => {
      web3Stub.currentProvider.request.resolves({ result: '12345' });
  
      try {
        await ETH.estimateGas({ network: 'unexpected' });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('No configuration found for ETH:unexpected and "realtime" compatible dataType');
      }
    });

    it('should reject on unexpected error in callback', async () => {
      web3Stub.currentProvider.request.resolves(null); // body is null
  
      try {
        await ETH.estimateGas({ network });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Cannot read properties of null (reading \'result\')');
      }
    });
  });
});
