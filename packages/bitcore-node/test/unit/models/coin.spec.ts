import { expect } from 'chai';
import { ObjectId } from 'mongodb';
import sinon from 'sinon';
import { BitcoinBlockStorage } from '../../../src/models/block';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { mockModel, mockStorage } from '../../helpers/index.js';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Coin Model', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  describe('_apiTransform', () => {
    it('should return the transform object with coin info', () => {
      let id = new ObjectId();
      let coin = {
        _id: id,
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        mintIndex: 0,
        mintHeight: 1,
        coinbase: true,
        value: 5000000000.0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        script: Buffer.from(''),
        wallets: [],
        spentTxid: '',
        spentHeight: SpentHeightIndicators.unspent
      } as ICoin;

      const result = CoinStorage._apiTransform(coin, { object: false });

      const parseResult = JSON.parse(result.toString());
      expect(parseResult).to.deep.equal({
        _id: id.toHexString(),
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        mintHeight: 1,
        network: 'regtest',
        confirmations: -1,
        mintIndex: 0,
        chain: 'BTC',
        spentTxid: '',
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        coinbase: true,
        script: '',
        spentHeight: SpentHeightIndicators.unspent,
        value: 5000000000.0
      });
    });
    it('should return the raw transform object if options field exists and set to true', () => {
      let id = new ObjectId();
      let coin = {
        _id: id,
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        mintIndex: 0,
        mintHeight: 1,
        coinbase: true,
        value: 5000000000.0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        script: Buffer.from(''),
        sequenceNumber: undefined,
        wallets: [],
        spentTxid: '',
        spentHeight: SpentHeightIndicators.unspent
      } as ICoin;

      const result = CoinStorage._apiTransform(coin, { object: true });
      expect(result).to.deep.equal({
        _id: id.toHexString(),
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        network: 'regtest',
        chain: 'BTC',
        spentTxid: '',
        mintHeight: 1,
        mintIndex: 0,
        spentHeight: SpentHeightIndicators.unspent,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        coinbase: true,
        confirmations: -1,
        script: '',
        sequenceNumber: undefined,
        value: 5000000000.0
      });
    });
  });

  describe('getBalanceAtTime', () => {
    let sandbox: sinon.SinonSandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should return an object with confirmed, unconfirmed, and balance when additional time parameter is passed in', async () => {
      let id = new ObjectId('5c364e342ab5602e97a56f0e');
      let chain = 'BTC';
      let network = 'regtest';
      let time = new Date().toISOString();
      let query = { wallets: id, 'wallets.0': { $exists: true } };
      let matchObject = {
        $or: [
          {
            spentHeight: {
              $gt: 123
            }
          },
          {
            spentHeight: -2
          }
        ],
        mintHeight: {
          $lte: 123
        },
        wallets: new ObjectId('5c364e342ab5602e97a56f0e'),
        'wallets.0': { $exists: true }
      };

      let blockModelHeight = { height: 123 };
      mockModel('coins', [
        { _id: 'confirmed', balance: 123123 },
        { _id: 'unconfirmed', balance: 1 }
      ]);
      mockModel('blocks', blockModelHeight);
      let coinModelAggregateSpy = CoinStorage.collection.aggregate as sinon.SinonSpy;
      let blockModelFindSpy = BitcoinBlockStorage.collection.find as sinon.SinonSpy;

      const result = await CoinStorage.getBalanceAtTime({ query, time, chain, network });
      expect(coinModelAggregateSpy.called).to.deep.equal(true, 'CoinStorage.aggregation should have been called');
      expect(blockModelFindSpy.called).to.deep.equal(true, 'BlockModel.find should have been called');
      expect(coinModelAggregateSpy.getCall(0).args[0][0].$match).to.deep.equal(matchObject);
      expect(result).to.has.property('confirmed');
      expect(result).to.has.property('unconfirmed');
      expect(result).to.has.property('balance');
      expect(result).to.deep.equal({ confirmed: 123123, unconfirmed: 1, balance: 123124 });
    });
  });

  describe('getBalance', () => {
    let sandbox: sinon.SinonSandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should return an object with confirmed, unconfirmed, and balance', async () => {
      let id = new ObjectId('5c364e342ab5602e97a56f0e');
      let query = {
        wallets: id,
        'wallets.0': { $exists: true },
        spentHeight: { $lt: 0 },
        mintHeight: { $gt: -3 }
      };

      mockStorage([
        { _id: 'confirmed', balance: 123123 },
        { _id: 'unconfirmed', balance: 1 }
      ]);
      let coinModelAggregateSpy = CoinStorage.collection.aggregate as sinon.SinonSpy;

      const result = await CoinStorage.getBalance({ query });
      expect(coinModelAggregateSpy.called).to.deep.equal(true, 'CoinStorage.aggregation should have been called');
      expect(coinModelAggregateSpy.getCall(0).args[0][0].$match).to.deep.equal(query);
      expect(result).to.has.property('confirmed');
      expect(result).to.has.property('unconfirmed');
      expect(result).to.has.property('balance');
      expect(result).to.deep.equal({ confirmed: 123123, unconfirmed: 1, balance: 123124 });
    });
  });
});
