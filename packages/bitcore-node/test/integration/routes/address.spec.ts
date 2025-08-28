import { describe } from 'mocha';
import app from '../../../src/routes';
import supertest from 'supertest';
import sinon from 'sinon';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase } from '../../helpers';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { expect } from 'chai';

const request = supertest(app);


const address1Coins: ICoin[] = [
  {
    chain: 'BTC',
    network: 'regtest',
    mintIndex: 0,
    mintTxid: '784ee052dac242eae9d26d49388c9e469dc0de8df69e9f3353623538ab5567ec',
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 1,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    chain: 'BTC',
    mintTxid: '0a8ff33d687fb95adf423ed03f2c51ca09b5e33077049c6b6ded7d78dc2f8d4f',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 2,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    chain: 'BTC',
    mintTxid: '9a7f8ad749c63bb30a88582ed3a5b5dbc311afb799ec6170d0e58814236f836f',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 3,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '2595e5efa5455c96ff376412172ab61c20c27a7260377c5b95913f1767c2d8d2'
  },
  {
    chain: 'BTC',
    mintTxid: '4b709c7b93ec86a4f5489b5aca184b1b90efbcc71c592ae38c07579d9f37cdd0',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 4,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '969f2a9bf11f040248f2860ae4d1d3e876c1195bcc1b0bf9ff0a475fca915f7b'
  },
  {
    chain: 'BTC',
    mintTxid: 'd3667993af738c3db4033dc462ab95f9916da455c628bbf71488484e2b6803c3',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 5,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0'
  },
  {
    chain: 'BTC',
    mintTxid: 'bfc01b8227291e6d9d7cddaea6ac3c5ec0ad4e8672757838701b6b618b4cb2be',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 6,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '9d12f47632fc55a7b8d4e533c2f6fcbec01e08bd17939267342c9f3a28b282dc'
  },
  {
    mintIndex: 0,
    mintTxid: 'd0cd3ac4c9f6cc5850a084a1a14a1face82e248fc8afa032b449ba945cdbf443',
    network: 'regtest',
    chain: 'BTC',
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 7,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '29567b4e313d9051164adb16346025b658db4959e9168cbf8f1b08a88b754897'
  },
  {
    mintIndex: 0,
    chain: 'BTC',
    mintTxid: 'decb8d186c04747d71c6545fe512f133d2d77750fa5e95a76894d98d2783e4ff',
    network: 'regtest',
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 8,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '064a49a48f05ef621c16d5e2688f1f10bb249f96dacc91d6de9907b4690196f9'
  },
  {
    mintIndex: 0,
    mintTxid: '4920cf18899bd570f718558fc6018a85362b07fc635c9687617c29d3f5fc7df5',
    network: 'regtest',
    chain: 'BTC',
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 9,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    chain: 'BTC',
    mintTxid: 'a367669f6c4c0c9c49b27fdbe87102b6720be7d6ba56b8131dbeaa9f929bf915',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 10,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: 111,
    value: 5000000000,
    wallets: [],
    sequenceNumber: 4294967293,
    spentTxid: '0e62f0e3f97a410a8c362cdaf2d7ab5dda9ab10e628b2f7d18184d50269c4b5d'
  },
  {
    mintIndex: 0,
    mintTxid: 'fc9a18bc9295a2d9eab4f6bdd20e56b1bcba1df0d9bc0f07050a95f0bd289447',
    network: 'regtest',
    chain: 'BTC',
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 11,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    chain: 'BTC',
    mintTxid: 'b7cfeb897decdfca5f62aeea96e6010263021d2888ecd133d4933bffbdecf8a1',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 12,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    chain: 'BTC',
    mintTxid: 'ae18c08d044f5ef57de3e98620e03ffd703a3367fdb192585b942e8924f70187',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 13,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    mintIndex: 0,
    mintTxid: '026f815c34fbabc8e70638c01c61f9ad65f401c792dc3b9117de28c630ed2980',
    network: 'regtest',
    chain: 'BTC',
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 14,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    mintTxid: '251adafd19e9e95ed896d7a31f3da20bfaf990ac0df18052bd21d402a5928f44',
    chain: 'BTC',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 15,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  },
  {
    chain: 'BTC',
    mintTxid: '1dd30b7d66f3850e15118fdd698958dabf8011c1704fb93c9bd84717cce83715',
    network: 'regtest',
    mintIndex: 0,
    address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
    coinbase: true,
    mintHeight: 16,
    script: Buffer.from('0014ecc5b1b3188c499d7968a2fc84581c18917cef7d0', 'hex'),
    spentHeight: -2,
    value: 5000000000,
    wallets: [],
    spentTxid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52'
  }
]


describe('Address Routes', function () {
  let sandbox;

  before(async () => {
    await intBeforeHelper();
    await resetDatabase();
    for (const coin of address1Coins) {
      await CoinStorage.collection.insertOne(coin);
    }
  })

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
  });

  after(async () => intAfterHelper());

  afterEach(async () => {
    sandbox.restore();
  });

  function expectCoinProps(coin) {
    expect(coin).to.have.property('chain');
    expect(coin).to.have.property('network');
    expect(coin).to.have.property('mintIndex');
    expect(coin).to.have.property('mintTxid');
    expect(coin).to.have.property('address');
    expect(coin).to.have.property('coinbase');
    expect(coin).to.have.property('mintHeight');
    expect(coin).to.have.property('script');
    expect(coin).to.have.property('spentHeight');
    expect(coin).to.have.property('value');
    expect(coin).to.have.property('wallets');
    expect(coin).to.have.property('spentTxid');
  }

  it('should get address coins /address/:address', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          expectCoinProps(coin);
        }
        done();
      });
  });

  it('should get address coins /address/:address/coins', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/coins')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          expectCoinProps(coin);
        }
        done();
      });
  });

  it('should get address coins /address/:address/txs', done => {
    request.get('/api/BTC/regtest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/txs')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const coins = res.body;
        for (const coin of coins) {
          expectCoinProps(coin);
        }
        done();
      });
  });

  it('should get address balance', done => {
    request.get('/api/BTC/retest/address/bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8/balance')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.haveOwnProperty('unconfirmed');
        expect(res.body).to.haveOwnProperty('confirmed');
        expect(res.body).to.haveOwnProperty('balance');
        done();
      });
  });
});