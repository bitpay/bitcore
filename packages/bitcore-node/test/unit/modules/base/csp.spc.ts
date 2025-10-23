import { expect } from 'chai';
import * as sinon from 'sinon';
import { MoralisStateProvider } from '../../../../src/modules/moralis/api/csp';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';


describe('BASE Chain State Provider', function() {
  const network = 'testnet';
  let BASE;
  before(() => {
    BASE = new MoralisStateProvider('BASE');
  });

  it('should be able to get web3', async () => {
    const sandbox = sinon.createSandbox();
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ BASE: { [network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await BASE.getWeb3(network);
    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.eq(2);
    expect(block).to.eq(1);
    sandbox.restore();
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const sandbox = sinon.createSandbox();
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().throws('Block number fails') } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ BASE: { [network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await BASE.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    expect(stub.callCount).to.not.exist;
    sandbox.restore();
  });
});