import { expect } from 'chai';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { ObjectId } from 'mongodb';

describe('Coin Model', function() {
  describe('_apiTransform', () => {
    it('should return the transform object with coin info', () => {
      let id = new ObjectId();
      let coin = {
        _id: id,
        network: 'regtest',
        chain: 'BTC',
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        mintIndex: 0,
        spentIndex: 0,
        mintHeight: 1,
        coinbase: true,
        value: 5000000000.0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        lockingScript: '',
        lockingScriptAsm: '',
        unlockingScript: '',
        unlockingScriptAsm: '',
        inputSequenceNumber: 0xffffffff,
        wallets: [],
        spentTxid: '',
        spentHeight: SpentHeightIndicators.unspent
      } as ICoin;

      const result = JSON.stringify(CoinStorage._apiTransform(coin));

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
        spentIndex: 0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        coinbase: true,
        lockingScript: '',
        lockingScriptAsm: '',
        unlockingScript: '',
        unlockingScriptAsm: '',
        inputSequenceNumber: 0xffffffff,
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
        spentIndex: 0,
        mintHeight: 1,
        coinbase: true,
        value: 5000000000.0,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        lockingScript: '',
        lockingScriptAsm: '',
        unlockingScript: '',
        unlockingScriptAsm: '',
        inputSequenceNumber: 0xffffffff,
        wallets: [],
        spentTxid: '',
        spentHeight: SpentHeightIndicators.unspent
      } as ICoin;

      const result = CoinStorage._apiTransform(coin);
      expect(result).to.deep.equal({
        _id: id.toHexString(),
        mintTxid: '81f24ac62a6ffb634b74e6278997f0788f3c64e844453f8831d2a526dc3ecb13',
        network: 'regtest',
        chain: 'BTC',
        spentTxid: '',
        spentIndex: 0,
        mintHeight: 1,
        mintIndex: 0,
        spentHeight: SpentHeightIndicators.unspent,
        address: 'n1ojJtS98D2VRLcTkaHH4YXLG4ytCyS7AL',
        coinbase: true,
        confirmations: -1,
        lockingScript: '',
        lockingScriptAsm: '',
        unlockingScript: '',
        unlockingScriptAsm: '',
        inputSequenceNumber: 0xffffffff,
        value: 5000000000.0
      });
    });
  });
});
