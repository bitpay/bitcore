const request = require('supertest')('http://localhost:3000');
const assert = require('assert');

describe('TX Api', () => {
  const TXID = '27e2e260f7f709007997127a1d2a9d05954e5024e6ad0ddec3fddfa2e9b7d36f';
  it('should be able to get the Transaction', (done) => {
    request
      .get(`/api/BTC/testnet/tx/${TXID}`)
      .expect(200, (err, { text }) => {
        assert.equal(text.includes(TXID), true);
        done();
      });
  });
});
