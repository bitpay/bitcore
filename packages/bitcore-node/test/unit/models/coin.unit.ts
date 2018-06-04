import { expect } from 'chai';
import { CoinModel } from '../../../src/models/coin';

describe('Coin Model', function () {

  describe('_apiTransform', () => {
    it('should return the transform object with coin info', () => {
      let coin = {
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        mintIndex: 0,
        mintHeight: 1,
        coinBase: true,
        value: 5000000000.0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        script: '',
        wallets: [],
        spentTxid: '',
        spentHeight: -2
      };

      const result = CoinModel._apiTransform(new CoinModel(coin), { object: false });

      const parseResult = JSON.parse(result);
      expect(parseResult).to.deep.equal({
        txid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        vout: 0,
        spentTxid: '',
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        script: '',
        value: 5000000000.0
      });
    });
    it('should return the raw transform object if options field exists and set to true', () => {
      let coin = {
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        mintIndex: 0,
        mintHeight: 1,
        coinBase: true,
        value: 5000000000.0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        script: '',
        wallets: [],
        spentTxid: '',
        spentHeight: -2
      };

      const result = CoinModel._apiTransform(new CoinModel(coin), { object: true });
      expect(result).to.deep.equal({
        txid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        vout: 0,
        spentTxid: '',
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        script: '',
        value: 5000000000.0
      });
    });
  });
});
