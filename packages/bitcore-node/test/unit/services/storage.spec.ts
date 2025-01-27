import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Storage Service', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    assert.ok(true);
  });
});
