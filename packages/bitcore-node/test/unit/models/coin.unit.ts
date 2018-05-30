import { expect } from 'chai';
import { CoinModel } from '../../../src/models/coin';

describe('Coin Model', function () {
  it('should have a test which runs', function () {
    expect(true).to.equal(true);
  });

  describe('_apiTransform', () => {
    it('should return the transform object with coin info', () => {
      let coin = {
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '',
        mindIndex: 1,
        mintHeight: 1,
        coinBase: '',
        value: '',
        address: '',
        script: '',
        wallets: '',
        spentTxid: '',
        spentHeight: ''
      };

      const result = CoinModel._apiTransform(new CoinModel(coin), { object: false });

      const parseResult = JSON.parse(result);
      expect(parseResult).to.deep.equal({
        txid: coin.mintTxid,
        vout: coin.mindIndex,
        spentTxid: coin.spentTxid,
        address: coin.address,
        script: coin.script,
        value: coin.value
      });
    });
    it('should return the raw transform object if options field exist and set to true', () => {
      let coin = {
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '',
        mindIndex: 1,
        mintHeight: 1,
        coinBase: '',
        value: '',
        address: '',
        script: '',
        wallets: '',
        spentTxid: '',
        spentHeight: ''
      };

      const result = CoinModel._apiTransform(new CoinModel(coin), { object: true });
      expect(result).to.deep.equal({
        txid: coin.mintTxid,
        vout: coin.mindIndex,
        spentTxid: coin.spentTxid,
        address: coin.address,
        script: coin.script,
        value: coin.value
      });
    });
  });

  describe('getBalance', () => {
    it('should return the balance of the coin', () => {
      let coin = {
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '',
        mindIndex: 1,
        mintHeight: 1,
        coinBase: '',
        value: '',
        address: '',
        script: '',
        wallets: '',
        spentTxid: '',
        spentHeight: ''
      };

    });
  });

});
