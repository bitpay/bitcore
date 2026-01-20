import { expect } from 'chai';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Storage Service', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });
});
