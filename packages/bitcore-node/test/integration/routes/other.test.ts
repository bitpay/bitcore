import supertest from 'supertest';
import { expect } from 'chai';
import app from '../../../src/routes';
import { RateLimitStorage } from '../../../src/models/rateLimit';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';


describe('Routes', function() {
  const request = supertest(app);

  before(async function() {
    this.timeout(15000);
  });

  it('should respond with a 404 status code for an unknown path', done => {
    request.get('/unknown').expect(404, done);
  });

  describe('RateLimiter', function() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const suite = this;
    this.timeout(30000);
    before(intBeforeHelper);
    after(async () => intAfterHelper(suite));

    beforeEach(async () => {
      await resetDatabase();
    });

    // The rate limiter middleware swallows errors, so a null result here would silently disable rate limiting
    it('should return the incremented document for each period', async () => {
      const first = await RateLimitStorage.incrementAndCheck('127.0.0.1', 'GLOBAL');
      expect(first.map(r => r.value?.period)).to.deep.eq(['second', 'minute', 'hour']);
      expect(first.map(r => r.value?.count)).to.deep.eq([1, 1, 1]);

      const second = await RateLimitStorage.incrementAndCheck('127.0.0.1', 'GLOBAL');
      expect(second.map(r => r.value?.count)).to.deep.eq([2, 2, 2]);
    });

    it('should count identifiers separately', async () => {
      await RateLimitStorage.incrementAndCheck('127.0.0.1', 'GLOBAL');
      const other = await RateLimitStorage.incrementAndCheck('10.0.0.1', 'GLOBAL');
      expect(other.map(r => r.value?.count)).to.deep.eq([1, 1, 1]);
    });
  });
});
