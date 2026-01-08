import { expect } from 'chai';
import { unitAfterHelper, unitBeforeHelper } from '../helpers/unit';

describe('server', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });
});
