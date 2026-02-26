import { expect } from 'chai';
import * as sinon from 'sinon';
import { Config } from '../../../src/services/config';
import { BaseP2PWorker, P2P } from '../../../src/services/p2p';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

class MockP2PWorker extends BaseP2PWorker<any> {
  started = false;

  constructor(params) {
    super(params);
    this.started = true;
  }
}
describe('P2P Service', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });

  it('should register a class', () => {
    const chain = 'TEST';
    P2P.register(chain, MockP2PWorker);
    const registered = P2P.get(chain);
    expect(registered).to.deep.eq(MockP2PWorker);
  });

  it('should start the p2p class', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'TEST';
    const network = 'testnet';
    const fakeConfig = {};

    P2P.register(chain, MockP2PWorker);
    sandbox.stub(Config, 'chainNetworks').returns([{ chain, network }]);
    sandbox
      .stub(Config, 'chainConfig')
      .withArgs({ chain, network })
      .returns(fakeConfig);

    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(`Worker length: ${P2P.workers.length}`).to.eq('Worker length: 1');
    expect(P2P.workers[0]).to.exist;
    const worker = P2P.workers[0] as MockP2PWorker;
    expect(worker.started).to.eq(true);
    await P2P.stop();
    expect(P2P.workers).to.deep.eq([]);
    sandbox.restore();
  });

  it('should not start if disabled', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'TEST';

    P2P.register(chain, MockP2PWorker);
    sandbox
      .stub(Config, 'isDisabled')
      .withArgs('p2p')
      .returns(true);
    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(P2P.workers.length).to.eq(0);
    sandbox.restore();
  });

  it('should not start if config has disabled', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'TEST';
    const network = 'testnet';
    const fakeConfig = { disabled: true };

    P2P.register(chain, MockP2PWorker);
    sandbox.stub(Config, 'chainNetworks').returns([{ chain, network }]);
    sandbox
      .stub(Config, 'chainConfig')
      .withArgs({ chain, network })
      .returns(fakeConfig);

    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(P2P.workers.length).to.eq(0);
    sandbox.restore();
  });

  it('should not start if config has chainSource other than p2p', async () => {
    const sandbox = sinon.createSandbox();
    const chain = 'TEST';
    const network = 'testnet';
    const fakeConfig = { chainSource: 'rpc' };

    P2P.register(chain, MockP2PWorker);
    sandbox.stub(Config, 'chainNetworks').returns([{ chain, network }]);
    sandbox
      .stub(Config, 'chainConfig')
      .withArgs({ chain, network })
      .returns(fakeConfig);

    expect(P2P.workers).to.deep.eq([]);
    await P2P.start();
    expect(P2P.workers.length).to.eq(0);
    sandbox.restore();
  });
});
