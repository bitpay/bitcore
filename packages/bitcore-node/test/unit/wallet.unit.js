const mongoose = require('./mock');
const app = require('../../lib/routes');
const sinon = require('sinon');
const request = require('supertest')(app);
const assert = require('assert');
const Wallet = mongoose.model('Wallet');

const WALLET = {
  chain: 'BTC',
  network: 'testnet',
  name: '{"iv":"68SeMjqIStpc791Z05drcg==","v":1,"iter":1,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","ct":"KfMGLa/+AlDpGNFr7Yer1ovE"}',
  pubKey: '03bdb94afdc7e5c4811bf9b160ac475b92156ea42c8659c8358b68c828df9a1c3d',
  path: 'm/44\'/0\'/0\''
};

beforeEach(() => {
  sinon.stub(Wallet, 'findOne').returns({
    exec: sinon.stub().returns(Promise.resolve(WALLET))
  });
});

afterEach(() => {
  Wallet.findOne.restore();
});
describe('Wallet Api', () => {
  it('should be able to create a wallet', (done) => {
    request
      .post('/api/BTC/testnet/wallet')
      .send(WALLET)
      .expect(200, (err, {
        body
      }) => {
        assert.equal(
          body.pubKey,
          WALLET.pubKey,
          'The wallet should be created with the passed in pubKey');
        done();
      });
  });

  it('should be able to find a wallet', (done) => {
    request
      .get('/api/BTC/testnet/wallet/somefakewalletid')
      .expect(200, (err, {
        text
      }) => {
        assert.equal(text.includes(WALLET.pubKey), true, 'The wallet should be found');
        done();
      });
  });
});
