import { describe, before, after, it } from 'node:test';
import assert from 'assert';
import { unitAfterHelper, unitBeforeHelper } from '../helpers/unit';

describe('rpc', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    assert.ok(true);
  });
});
