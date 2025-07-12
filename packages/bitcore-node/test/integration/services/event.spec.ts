import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import { Event } from '../../../src/services/event';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Event Service', { timeout: 30000 }, function(suite) {
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  it('should be able to start and stop', async () => {
    assert.doesNotReject(async () => await Event.start(), 'Event.start() should not throw');
    assert.doesNotReject(async () => await Event.stop(), 'Event.stop() should not throw');
  });
});
