import { expect } from 'chai';
import * as sinon from 'sinon';
import type { Web3Types } from '@bitpay-labs/crypto-wallet-core';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';

describe('BaseEVMStateProvider ERC20 transfer block ranges', function() {
  const sandbox = sinon.createSandbox();
  const address = '0x1111111111111111111111111111111111111111';
  const recipient = '0x2222222222222222222222222222222222222222';
  const tokenAddress = '0x3333333333333333333333333333333333333333';
  let provider: BaseEVMStateProvider;
  let getPastEvents: sinon.SinonStub;

  beforeEach(() => {
    provider = Object.create(BaseEVMStateProvider.prototype);
    getPastEvents = sandbox.stub().callsFake(async (_event, options) => {
      if (!options.filter._from) {
        return [];
      }
      const events: Array<Partial<Web3Types.EventLog>> = [];
      for (let block = options.fromBlock; block <= options.toBlock; block++) {
        events.push({
          blockNumber: block,
          blockHash: '0x' + block.toString(16).padStart(64, '0'),
          transactionHash: '0x' + block.toString(16).padStart(64, '0'),
          transactionIndex: 0n,
          returnValues: { _from: address, _to: recipient, _value: '1' }
        });
      }
      return events;
    });
    sandbox.stub(provider, 'erc20For').resolves({ getPastEvents });
    sandbox.stub(provider, 'getWeb3').resolves({
      web3: { eth: { getBlockNumber: sandbox.stub().resolves(20000n) } }
    });
  });

  afterEach(() => sandbox.restore());

  for (const [startBlock, endBlock] of [[100, 100], [0, 100], [0, 101], [0, 202], [0, 10000]]) {
    it(`returns every matching block in the inclusive range ${startBlock}..${endBlock}`, async () => {
      const transfers = await provider.getErc20Transfers('regtest', address, tokenAddress, { startBlock, endBlock });
      const expected = Array.from({ length: endBlock - startBlock + 1 }, (_, i) => startBlock + i);
      expect(transfers.map(tx => Number(tx.blockNumber)).sort((a, b) => a - b)).to.deep.equal(expected);
      expect(transfers.every(tx => tx.from === address && tx.to === recipient && tx.value === 1)).to.be.true;

      const calls = getPastEvents.getCalls();
      expect(calls.length).to.be.greaterThan(0);
      expect(calls.filter(call => call.args[1].filter._from).length).to.equal(
        calls.filter(call => call.args[1].filter._to).length
      );
      for (const call of calls) {
        expect(call.args[0]).to.equal('Transfer');
        expect(call.args[1].fromBlock >= BigInt(startBlock)).to.be.true;
        expect(call.args[1].toBlock <= BigInt(endBlock)).to.be.true;
      }
    });
  }

  it('propagates an RPC rejection instead of returning partial history', async () => {
    const error = new Error('mock RPC rejected');
    getPastEvents.rejects(error);
    let observed;
    try {
      await provider.getErc20Transfers('regtest', address, tokenAddress, { startBlock: 0, endBlock: 100 });
    } catch (caught) {
      observed = caught;
    }
    expect(observed).to.equal(error);
  });

  it('rejects reversed bounds before asking for any Transfer events', async () => {
    let observed;
    try {
      await provider.getErc20Transfers('regtest', address, tokenAddress, { startBlock: 100, endBlock: 99 });
    } catch (caught) {
      observed = caught;
    }
    expect(observed).to.be.instanceOf(Error);
    expect((observed as Error).message).to.equal('startBlock cannot be greater than endBlock');
    expect(getPastEvents.callCount).to.equal(0);
  });
});
