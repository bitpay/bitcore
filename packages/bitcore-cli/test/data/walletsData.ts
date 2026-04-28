export const btcSingleSigWallet = {
  _id: '6972a1648b48ae9c39b5e6c6',
  version: '1.0.0',
  createdOn: 1769120100,
  id: '62e38685-f8e8-40d4-967f-04afc6aaf75a',
  name: '{"iv":"1XcvvqJg/i9oMPz0TA==","v":1,"ts":128,"mode":"ccm","adata":"","cipher":"aes","ct":"Yjea/05D442crEePZ61547GHL0JJ3qM+hzyVUQQ=","ks":128}',
  m: 1,
  n: 1,
  singleAddress: false,
  status: 'complete',
  publicKeyRing: [
    {
      xPubKey: 'tpubDCKPndk1XFyHP68Znm9u2aAh337uzYuAskuRC8aN73iDeWjXtetsZg55exJkaAxq64wZkU8Ea5gsyazYM7ourdK4nQcZVF2kHYTwaNUsr7F',
      requestPubKey: '03d001f4439c9901b61979591b75e919fcfb1ffe1bd152ce0b5131be4de5ec8f79'
    }
  ],
  copayers: [
    {
      version: 2,
      createdOn: 1769120100,
      coin: 'btc',
      chain: 'btc',
      xPubKey: 'tpubDCKPndk1XFyHP68Znm9u2aAh337uzYuAskuRC8aN73iDeWjXtetsZg55exJkaAxq64wZkU8Ea5gsyazYM7ourdK4nQcZVF2kHYTwaNUsr7F',
      id: '90348b306bb58881013c63fe1238eddabf327836b2be808cdc9ebf97a426d9a5',
      name: '{"iv":"mRHROe2EFzG8ML8DJA==","v":1,"ts":128,"mode":"ccm","adata":"","cipher":"aes","ct":"OUsZkjyrsgCXfiesTtWihJtJ10O5zMg=","ks":128}',
      requestPubKey: '03d001f4439c9901b61979591b75e919fcfb1ffe1bd152ce0b5131be4de5ec8f79',
      signature: '3044022057ea43cad38c3aba5922b25ec62d7c8842df51c49fc3711de5e8124527e5dbc102207353939f748defa938e33b6fa5d38a9a96a957ff37d741c3230533dd8d55787a',
      requestPubKeys: [
        {
          key: '03d001f4439c9901b61979591b75e919fcfb1ffe1bd152ce0b5131be4de5ec8f79',
          signature: '3044022057ea43cad38c3aba5922b25ec62d7c8842df51c49fc3711de5e8124527e5dbc102207353939f748defa938e33b6fa5d38a9a96a957ff37d741c3230533dd8d55787a'
        }
      ],
      customData: '{"iv":"K8tACWgvaUzROguZbA==","v":1,"ts":128,"mode":"ccm","adata":"","cipher":"aes","ct":"fEpVWj5kkVr2bZAVvtaxAUQ3n1T3eMJ8oIOiu0pa9oV8Rxe020XRitJ0puBocm71ntNCjj3s32TYUaq40YKG80kCEgg2lmheG0mazLnISRHNBUFKF1//nMPfwa2Ya1zidRd+2A==","ks":128}'
    }
  ],
  pubKey: '02665d4f16c446af06f4273bce80ff237f8c1eec77b710390722b4eded95a094ae',
  coin: 'btc',
  chain: 'btc',
  network: 'testnet',
  derivationStrategy: 'BIP44',
  addressType: 'P2WPKH',
  addressManager: {
    version: 2,
    derivationStrategy: 'BIP44',
    receiveAddressIndex: 0,
    changeAddressIndex: 0,
    copayerIndex: 2147483647,
    skippedPaths: []
  },
  scanStatus: '',
  beRegistered: true,
  beAuthPrivateKey2: '0c2738b1d810577777cd0db360335a75d217b1f3ab7841580acee5b8092a3d66',
  beAuthPublicKey2: '0499fafc994b7a9461a337eaf38e054f55558a889f7846889373c36c285785fc4f9fbd041a8328fc6a6dd452750f92ae23fdac7c2fe761d3d1127ab307bfa846a2',
  nativeCashAddr: '',
  usePurpose48: false,
  isShared: false
};

btcSingleSigWallet['toObject'] = () => btcSingleSigWallet;