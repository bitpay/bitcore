import { expect } from 'chai';
import { EventStorage } from '../../../src/models/events';
import { Event } from '../../../src/services/event';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Event Service', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  it('should be able to start and stop', async () => {
    await Event.start();
    await Event.stop();
    expect(true).to.equal(true);
  });

  it('records when a block of each chain and network last arrived', async () => {
    Event.lastBlockTimes.clear();
    await Event.start();
    try {
      const before = Date.now();
      // chains no other test signals blocks for
      await EventStorage.signalBlock({ chain: 'TESTA', network: 'mainnet', height: 1, hash: 'a' } as any);
      await EventStorage.signalBlock({ chain: 'TESTB', network: 'testnet', height: 1, hash: 'b' } as any);
      const until = Date.now() + 5000;
      while (Event.lastBlockTime('TESTB', 'testnet') === undefined && Date.now() < until) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(Event.lastBlockTime('TESTA', 'mainnet')).to.be.at.least(before);
      expect(Event.lastBlockTime('TESTB', 'testnet')).to.be.at.least(before);
      expect(Event.lastBlockTime('TESTA', 'testnet')).to.equal(undefined);
      expect(Event.lastBlockTime('TESTB', 'mainnet')).to.equal(undefined);
    } finally {
      await Event.stop();
      Event.lastBlockTimes.clear();
    }
  });
});
