const request = require('supertest')('http://localhost:3000');

const UTXO = {
  txid: '27e2e260f7f709007997127a1d2a9d05954e5024e6ad0ddec3fddfa2e9b7d36f',
  vout: 1,
  address: 'mhjTB1BvPsaWUKX3baWk551Hdi5Cf51vsQ',
  script: '76a914184d5980f9a638c191f1a9c02114673e687dbdbc88ac',
  value: 250000
};

describe('Address API', () => {
  const TESTNET_ADDR = 'mhjTB1BvPsaWUKX3baWk551Hdi5Cf51vsQ';
  it('should be able to stream address UTXOs', (done) => {
    request
      .get(`/api/BTC/testnet/address/${TESTNET_ADDR}`)
      .expect(200, [UTXO], done);
  });
  it('should be able to get address balance', (done) => {
    request
      .get(`/api/BTC/testnet/address/${TESTNET_ADDR}/balance`)
      .expect(200, {balance: UTXO.value},  done);
  });
});
