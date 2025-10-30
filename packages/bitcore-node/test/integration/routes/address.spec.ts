import { describe } from 'mocha';
import app from '../../../src/routes';
import supertest from 'supertest';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase, testCoin } from '../../helpers';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { expect } from 'chai';

const request = supertest(app);


const address1Coins: ICoin[] = [
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '0ef2258370c1a2f7ab66615c0cc13bce45fd6a787e5e0bd3ba382ef5a1abf813',
    mintHeight: 111,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000112800,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '68a32aaf3fdd37d5ad5b7ed85b482a49254e98fd908636a4fd886f2bd80fbde5',
    mintHeight: 107,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: 'b2dce546b533ab15798f074e17818a42d96ce2388ac4120854b15fbab2679e04',
    mintHeight: 109,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '6460e3a0ced11db7046b92a49098471c2f665d28eaeae1b710ade423a68a525d',
    mintHeight: 108,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '7b0eab0d74163bae5bf0e053a64519aa85aca68a3ff9457db6dec69e3420ec22',
    mintHeight: 107,
    spentHeight: 118,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: 'aff0eb4844ff64043465971224be92f3e80e23e86e302f76316f31b287d612f6',
    mintHeight: 106,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '91c1449248394e297d8ef93185f09d77494c626c0d845607fc6b59976891fa7d',
    mintHeight: 105,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '3f8df18d023c25db19969822f8b52a51932dfd73a94bea04655b90539d082cf8',
    mintHeight: 104,
    spentHeight: 120,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: 'fce3efb3a3ce16f98be6063a0f041dae231d6df6ae2a49895d0dc2a48f6c6835',
    mintHeight: 103,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: 'a1f319579d76a67e251f7f53c6f6fabf2e1c21eef7e1aaf6a6733153f1c17309',
    mintHeight: 102,
    spentHeight: -2,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
    value: 5000000000,
    confirmations: -1,
    wallets: []
  }
];

const address1Balance = { unconfirmed: 0, confirmed: 0, balance: 0 };

describe('Address Routes', function () {
  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
    await CoinStorage.collection.insertMany(address1Coins);
    for (const coin of address1Coins) {
      if (coin.spentHeight > 0)
        continue;
      address1Balance.balance += coin.value;
      if (coin.mintHeight >= 0)
        address1Balance.confirmed += coin.value;
      else
        address1Balance.unconfirmed += coin.value;
    }
  });

  after(async () => intAfterHelper());

  it('should get address coins /api/BTC/regtest/address/:address', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address and limit', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8?limit=5')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        expect(coins.length).to.equal(5);
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address, and filter for unspent', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8?limit=500&unspent=true')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          expect(coin.spentHeight).to.be.lessThan(0);
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address/coins', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/coins')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address/coins and limit', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/coins?limit=5')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        expect(coins.length).to.equal(5);
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address/coins and filter for unspent', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/coins?limit=5')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        expect(coins.length).to.equal(5);
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address/txs', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/txs')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address/txs and limit', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/txs?limit=5')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        expect(coins.length).to.equal(5);
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address coins /api/BTC/regtest/address/:address/txs and filter for unspent', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/txs?limit=500&unspent=true')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          testCoin(coin);
        }
        done();
      });
  });

  it('should get address balance', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/balance')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body.balance).to.equal(address1Balance.balance);
        expect(res.body.confirmed).to.equal(address1Balance.confirmed);
        expect(res.body.unconfirmed).to.equal(address1Balance.unconfirmed);
        done();
      });
  });
});