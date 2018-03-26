const request = require('supertest')('http://localhost:3000');
const assert = require('assert');

describe('Block API', () => {
  const BLOCK_NUM = 1;
  it('should be able to get the first block', (done) => {
    request
      .get(`/api/BTC/testnet/block/${BLOCK_NUM}`)
      .expect(200, (err, { body })=> {
        assert.equal(body.height, 1);
        done();
      });
  });
});
