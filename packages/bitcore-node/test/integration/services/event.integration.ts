import { expect } from 'chai';
import { Event } from '../../../src/services/event';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Event Service', function() {
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  it('should be able to start and stop', async () => {
    await Event.start();
    await Event.stop();
    expect(true).to.equal(true);
  });
});
