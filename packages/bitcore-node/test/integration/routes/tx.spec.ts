import supertest from 'supertest';
import app from '../../../src/routes';
import { describe } from 'mocha';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase, testCoin } from '../../helpers';
import { expect } from 'chai';
import { ITransaction, TransactionStorage } from '../../../src/models/transaction';
import { CoinStorage, ICoin } from '../../../src/models/coin';


describe('Tx Routes', function() {
  const request = supertest(app);
  
  const transactions = [
    {
      network: 'regtest',
      txid: '8313f0b9645c64834e017029e7d3aecd27a3d4c68e4c47d3b5b46f342d1dcf52',
      chain: 'BTC',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 111,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      chain: 'BTC',
      txid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
      network: 'regtest',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 111,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      network: 'regtest',
      chain: 'BTC',
      txid: '969f2a9bf11f040248f2860ae4d1d3e876c1195bcc1b0bf9ff0a475fca915f7b',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 111,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      chain: 'BTC',
      txid: '0e62f0e3f97a410a8c362cdaf2d7ab5dda9ab10e628b2f7d18184d50269c4b5d',
      network: 'regtest',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 112,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      chain: 'BTC',
      txid: '064a49a48f05ef621c16d5e2688f1f10bb249f96dacc91d6de9907b4690196f9',
      network: 'regtest',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 113,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      chain: 'BTC',
      network: 'regtest',
      txid: '9d12f47632fc55a7b8d4e533c2f6fcbec01e08bd17939267342c9f3a28b282dc',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 113,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      chain: 'BTC',
      txid: '2595e5efa5455c96ff376412172ab61c20c27a7260377c5b95913f1767c2d8d2',
      network: 'regtest',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 114,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    },
    {
      chain: 'BTC',
      network: 'regtest',
      txid: '29567b4e313d9051164adb16346025b658db4959e9168cbf8f1b08a88b754897',
      blockHash: '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050',
      blockHeight: 115,
      blockTime: new Date('2025-08-28T14:46:51.000Z'),
      blockTimeNormalized: new Date('2025-08-28T14:46:51.000Z'),
      coinbase: false,
      fee: 14100,
      inputCount: 1,
      locktime: 110,
      outputCount: 2,
      size: 113,
      value: 4999985900,
      wallets: []
    }
  ];
  
  const coins: ICoin[] = [
    {
      chain: 'BTC',
      network: 'regtest',
      coinbase: true,
      mintIndex: 0,
      spentTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
      mintTxid: 'd3667993af738c3db4033dc462ab95f9916da455c628bbf71488484e2b6803c3',
      mintHeight: 5,
      spentHeight: 111,
      address: 'bcrt1qanzmr0rzxynktedz30epzcrsvfzl8005ppz0d8',
      script: Buffer.from('0014ecc5b1bc62312765e5a28bf21160706245f3bdf4', 'hex'),
      value: 5000000000,
      confirmations: 1,
      sequenceNumber: 4294967293,
      wallets: []
    },
    {
      chain: 'BTC',
      network: 'regtest',
      coinbase: false,
      mintIndex: 0,
      spentTxid: '',
      mintTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
      mintHeight: 111,
      spentHeight: -2,
      address: 'bcrt1qhx4uesqfc48plrfw6u8z39068rm0palteu4lqv',
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      value: 100000,
      confirmations: 1,
      sequenceNumber: 4294967295,
      wallets: []
    },
    {
      chain: 'BTC',
      network: 'regtest',
      coinbase: false,
      mintIndex: 1,
      spentTxid: '',
      mintTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
      mintHeight: 111,
      spentHeight: -2,
      address: 'bcrt1qc29l5h3uh33zgugw582kj0r9r2y6zna58gnkes',
      script: Buffer.from('0014c28bfa5e3cbc6224710ea1d5693c651a89a14fb4', 'hex'),
      value: 4999885900,
      confirmations: 1,
      sequenceNumber: 4294967295,
      wallets: []
    },
    {
      mintIndex: 0,
      network: 'regtest',
      mintTxid: '30ef4d50173b431c2649643a4c452f99c3feaf39246866ed403f459cc27c5913',
      chain: 'BTC',
      address: 'bcrt1qgw85g3zr0emah2wx2fvs9pxcg95xgslk9yffhs',
      coinbase: false,
      mintHeight: 113,
      script: Buffer.from('0014c28bfa5e3cbc6224710ea1d5693c651a89a14fb4', 'hex'),
      spentHeight: 113,
      value: 31598971800,
      wallets: [],
      sequenceNumber: 4294967293,
      spentTxid: '018811ac64369081011c93266652fe7907fcde5ede10f7400005018459858781'
    },
    {
      network: 'regtest',
      mintIndex: 0,
      chain: 'BTC',
      mintTxid: 'a7639933badf18bd7f2cb76ed7b88efeb6aefef317f1ee769dd81737a6e62523',
      address: 'bcrt1qzjfr6a043d93tje9s0s46apex7u8jp8zr3m9fk',
      coinbase: false,
      mintHeight: 113,
      spentTxid: '',
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      spentHeight: -2,
      value: 10000000000,
      wallets: []
    },
    {
      network: 'regtest',
      mintIndex: 1,
      chain: 'BTC',
      mintTxid: 'a7639933badf18bd7f2cb76ed7b88efeb6aefef317f1ee769dd81737a6e62523',
      address: 'bcrt1q5x28tlz8fw9gk8um2c8rj48hv6qypul3ztfr4k',
      coinbase: false,
      mintHeight: 113,
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      spentHeight: 113,
      value: 11598943600,
      wallets: [],
      sequenceNumber: 4294967293,
      spentTxid: 'e532e34a93d11b792c117ec92058a2115feb8cbc98fdfd0073f1ed26731152c4'
    },
    {
      mintIndex: 0,
      mintTxid: 'e532e34a93d11b792c117ec92058a2115feb8cbc98fdfd0073f1ed26731152c4',
      chain: 'BTC',
      network: 'regtest',
      spentTxid: '',
      address: 'bcrt1qzjfr6a043d93tje9s0s46apex7u8jp8zr3m9fk',
      coinbase: false,
      mintHeight: 113,
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      spentHeight: -2,
      value: 10000000000,
      wallets: []
    },
    {
      network: 'regtest',
      mintIndex: 1,
      chain: 'BTC',
      mintTxid: 'e532e34a93d11b792c117ec92058a2115feb8cbc98fdfd0073f1ed26731152c4',
      address: 'bcrt1qudtnxthw4y286g5q6p364zuknxq7ts30vfrwsn',
      coinbase: false,
      mintHeight: 113,
      spentTxid: '',
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      spentHeight: -2,
      value: 1598929500,
      wallets: []
    },
    {
      mintIndex: 1,
      mintTxid: '018811ac64369081011c93266652fe7907fcde5ede10f7400005018459858781',
      chain: 'BTC',
      network: 'regtest',
      address: 'bcrt1qrezp2ha82ra8mnhnd8uge3wsve37ccquek233e',
      coinbase: false,
      mintHeight: 113,
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      spentHeight: 113,
      value: 21598957700,
      wallets: [],
      sequenceNumber: 4294967293,
      spentTxid: 'a7639933badf18bd7f2cb76ed7b88efeb6aefef317f1ee769dd81737a6e62523'
    },
    {
      network: 'regtest',
      mintIndex: 0,
      chain: 'BTC',
      mintTxid: '018811ac64369081011c93266652fe7907fcde5ede10f7400005018459858781',
      address: 'bcrt1qzjfr6a043d93tje9s0s46apex7u8jp8zr3m9fk',
      coinbase: false,
      spentTxid: '',
      mintHeight: 113,
      script: Buffer.from('0014b9abccc009c54e1f8d2ed70e2895fa38f6f0f7eb', 'hex'),
      spentHeight: -2,
      value: 10000000000,
      wallets: []
    }
  ];
  
  before(async () => {
    await intBeforeHelper();
    await resetDatabase();

    await TransactionStorage.collection.insertMany(transactions);
    await CoinStorage.collection.insertMany(coins);
  });

  after(async() => {
    await intAfterHelper();
  });

  function testTransaction(transaction) {
    expect(transaction).to.be.an('object');
    expect(transaction).to.have.property('txid').that.is.a('string');
    expect(transaction).to.have.property('chain').that.is.a('string');
    expect(transaction).to.have.property('network').that.is.a('string');
    expect(transaction).to.have.property('blockHash').that.is.a('string');
    expect(transaction).to.have.property('blockHeight').that.is.a('number');
    expect(transaction).to.have.property('blockTime');
    expect(new Date(transaction.blockTime)).to.be.a('date');
    expect(transaction).to.have.property('blockTimeNormalized');
    expect(new Date(transaction.blockTimeNormalized)).to.be.a('date');
    expect(transaction).to.have.property('coinbase').that.is.a('boolean');
    expect(transaction).to.have.property('fee').that.is.a('number');
    expect(transaction).to.have.property('inputCount').that.is.a('number');
    expect(transaction).to.have.property('outputCount').that.is.a('number');
    expect(transaction).to.have.property('locktime').that.is.a('number');
    expect(transaction).to.have.property('size').that.is.a('number');
    expect(transaction).to.have.property('value').that.is.a('number');

    if ('confirmations' in transaction) {
      expect(transaction.confirmations).to.be.a('number');
    }

    if (!transaction.coinbase) {
      expect(transaction.inputCount).to.be.at.least(1);
    }
  }

  it('should get transaction on /api/BTC/regtest/tx?blockHeight=113', done => {
    request.get('/api/BTC/regtest/tx?blockHeight=113')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const transactions = res.body;
        for (const transaction of transactions) {
          testTransaction(transaction);
          expect(transaction.chain).to.equal('BTC');
          expect(transaction.network).to.equal('regtest');
          expect(transaction.blockHeight).to.equal(113);
        }
        done();
      });
  });

  it('should get transaction on /api/BTC/regtest/tx?blockHash=[blockHash]', done => {
    const blockHash = '6a8fea1b3b598ecdf3cd3d117d4c406d06a7e540d29b5c3a47e208b3cdea8050';
    request.get(`/api/BTC/regtest/tx?blockHash=${blockHash}`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const transactions = res.body;
        for (const transaction of transactions) {
          testTransaction(transaction);
          expect(transaction.chain).to.equal('BTC');
          expect(transaction.network).to.equal('regtest');
          expect(transaction.blockHash).to.equal(blockHash);
        }
        done();
      });
  });

  it('should get transaction on /api/BTC/regtest/tx/:txId', done => {
    const txid = '0e62f0e3f97a410a8c362cdaf2d7ab5dda9ab10e628b2f7d18184d50269c4b5d'; // defined in transactions array
    request.get(`/api/BTC/regtest/tx/${txid}`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const transaction = res.body;
        testTransaction(transaction);
        expect(transaction.txid).to.equal(txid);
        expect(transaction.chain).to.equal('BTC');
        expect(transaction.network).to.equal('regtest');
        done();
      });
  });

  it('should get transaction with inputs and outputs on /api/BTC/regtest/tx/:txId/populated', done => {
    const txid = '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0'; // defined in transactions array
    request.get(`/api/BTC/regtest/tx/${txid}/populated`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const transaction: Partial<ITransaction> = res.body;
        const { inputs, outputs } = res.body.coins;

        testTransaction(transaction);
        expect(transaction.txid).to.equal(txid);
        expect(transaction.chain).to.equal('BTC');
        expect(transaction.network).to.equal('regtest');

        for (const coin of inputs) {
          testCoin(coin);
          expect(coin.chain).to.equal('BTC');
          expect(coin.network).to.equal('regtest');
          expect(coin.spentTxid).to.equal(txid);
        }
        for (const coin of outputs) {
          testCoin(coin);
          expect(coin.chain).to.equal('BTC');
          expect(coin.network).to.equal('regtest');
          expect(coin.mintTxid).to.equal(txid);
        }
        done();
      });
  });

  it('should get on /api/BTC/regtest/tx/:txId/authhead', done => {
    request.get('/api/BTC/regtest/tx/30ef4d50173b431c2649643a4c452f99c3feaf39246866ed403f459cc27c5913/authhead')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { chain, network, authbase, identityOutputs } = res.body;
        expect(chain).to.equal('BTC');
        expect(network).to.equal('regtest');
        expect(authbase).to.exist.and.to.be.a('string');
        for (const coin of identityOutputs) {
          testCoin(coin);
          expect(coin.chain).to.equal('BTC');
          expect(coin.network).to.equal('regtest');
          expect(coin.spentHeight).to.be.at.most(-1);
        }
        done();
      });
  });

  it('should get transaction inputs and outputs on /api/BTC/regtest/tx/:txId/coins', done => {
    const txid = '0e62f0e3f97a410a8c362cdaf2d7ab5dda9ab10e628b2f7d18184d50269c4b5d'; // defined in transactions array
    request.get(`/api/BTC/regtest/tx/${txid}/coins`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { inputs, outputs } = res.body;
        for (const coin of inputs) {
          testCoin(coin);
          expect(coin.chain).to.equal('BTC');
          expect(coin.network).to.equal('regtest');
          expect(coin.spentTxid).to.equal(txid);
        }
        for (const coin of outputs) {
          testCoin(coin);
          expect(coin.chain).to.equal('BTC');
          expect(coin.network).to.equal('regtest');
        }
        done();
      });
  });
});