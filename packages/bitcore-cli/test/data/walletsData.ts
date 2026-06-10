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

export const btcMultiSigWallet = {
  _id: '69cd35b92927367674f44989',
  version: '1.0.0',
  createdOn: 1775056313,
  id: '2eaa8627-6e87-47fb-a08b-18b94a24a57b',
  name: '{"iv":"fepLjAjdfF+QoCHm","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"erIQzvlzzN+tjmRt1RGge669P73JFWO6grMNR+p4yMZ2qg==","ks":128}',
  m: 2,
  n: 2,
  singleAddress: false,
  status: 'complete',
  publicKeyRing: [
    {
      xPubKey: 'tpubDDJkksaWgxS91YXVJP1H2wHbZCECB3V3ZCU3c5G233neXKThR4PQHyXH9yiqwU5PsQjNbqhSS1gyCy53WMjrcBfSnsjw8gdk34pnsg9MSoz',
      requestPubKey: '03ecdd7993f0d94180d1eb3365ffd1c10b135cf13ea382a536eecd503e4f9ade0c'
    },
    {
      xPubKey: 'tpubDCEzKTmpWTSXg8mHfsLjV36dKqkQ1knxcK2ueFNfGGs7ywxNeDttEtyEyqhxG3wgxTHYBTRfiYddjhu2iNidVUWnT3BEDGcoPHxg77dig46',
      requestPubKey: '02d9cd44679b6a4692609266d7a1e7b131663ca5d53216e286c133f4996de50b65'
    }
  ],
  copayers: [
    {
      version: 2,
      createdOn: 1775056313,
      coin: 'btc',
      chain: 'btc',
      xPubKey: 'tpubDDJkksaWgxS91YXVJP1H2wHbZCECB3V3ZCU3c5G233neXKThR4PQHyXH9yiqwU5PsQjNbqhSS1gyCy53WMjrcBfSnsjw8gdk34pnsg9MSoz',
      id: 'd6732fe95a69efd54481468a595271a327856f8552a062e2f7619d2299faf6b7',
      name: '{"iv":"uKDHWSfF3DMCq7zR","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"c3/wpVO4450k9rFDdkhUp4DrCmcP+T++","ks":128}',
      requestPubKey: '03ecdd7993f0d94180d1eb3365ffd1c10b135cf13ea382a536eecd503e4f9ade0c',
      signature: '3044022012563b9722a8ec566aa5ab324d7bcd75a3f2c2410c39e1a0cb3b8830e03d4cd202206c81377d16b152187d4fadf89a184049213eb2271a23a5a14db818b99091918c',
      requestPubKeys: [
        {
          key: '03ecdd7993f0d94180d1eb3365ffd1c10b135cf13ea382a536eecd503e4f9ade0c',
          signature: '3044022012563b9722a8ec566aa5ab324d7bcd75a3f2c2410c39e1a0cb3b8830e03d4cd202206c81377d16b152187d4fadf89a184049213eb2271a23a5a14db818b99091918c'
        }
      ],
      customData: '{"iv":"ojUTyByikLvX5dfP","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"CuPpQPp/MsVG1NXNq9lsbTiR+J+j3wbEnR1EwcHIlJs7s4OFClVYX93sKutJglMPbW2KzwjmGzI2VjSbGbrlGW0pjvIf15lOT/p/CABie3y1L5tqLtShpkOQuZD95hFbwj/atg==","ks":128}'
    },
    {
      version: 2,
      createdOn: 1775056318,
      coin: 'btc',
      chain: 'btc',
      xPubKey: 'tpubDCEzKTmpWTSXg8mHfsLjV36dKqkQ1knxcK2ueFNfGGs7ywxNeDttEtyEyqhxG3wgxTHYBTRfiYddjhu2iNidVUWnT3BEDGcoPHxg77dig46',
      id: 'cd36d8b92711ec692fed6bf2f275260375b5f5b279db013b5b947238134c1202',
      name: '{"iv":"c4+NkyBT0APR7HgE","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"VlB3P/atWh30Q8Jvt5gg6h2U53YeAAA7","ks":128}',
      requestPubKey: '02d9cd44679b6a4692609266d7a1e7b131663ca5d53216e286c133f4996de50b65',
      signature: '3045022100f4603c78c95f5a2d45499497e107c2ef4e82c427ea8e29581d3537d640d8247f022029cd835b333dbf9d6ae4759f447bf855e7ee6fa44a2ddf657e6607404c1f7221',
      requestPubKeys: [
        {
          key: '02d9cd44679b6a4692609266d7a1e7b131663ca5d53216e286c133f4996de50b65',
          signature: '3045022100f4603c78c95f5a2d45499497e107c2ef4e82c427ea8e29581d3537d640d8247f022029cd835b333dbf9d6ae4759f447bf855e7ee6fa44a2ddf657e6607404c1f7221'
        }
      ],
      customData: '{"iv":"F/hUXHQQW612aqGj","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"BOuHX6cjQHs7BSIfS2cZlXGmUGm9b6vcTGbSFlqqnnE3LiXXZbG4UtRa0bOEpZT2PVJr/FUUialzUOfJ2+DnQ83wMlFHTCOPjBsTYw4OSqHjtFwjx6jUpMdCphSZuJnSUyEMDQ==","ks":128}'
    }
  ],
  pubKey: '03abe75c36c11b89c5427b3ad5d685f8081f07b237ce2ef23424204e585da7cda5',
  coin: 'btc',
  chain: 'btc',
  network: 'testnet4',
  derivationStrategy: 'BIP44',
  addressType: 'P2WSH',
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
  beAuthPrivateKey2: 'a9fa65659133566f815b5f5417ef3d0b3da7f24bd87c8f53df31b80358727014',
  beAuthPublicKey2: '0493857bbc23ae07d5acdd77a3a03d178068035c73fa9dd1149f608ce04483c8244d6cf609d4ba072ec2712d8b07069b86dcda7e4f504286dc94a2b84fdf1a2278',
  nativeCashAddr: '',
  usePurpose48: true,
  isShared: true
};

btcMultiSigWallet['toObject'] = () => btcMultiSigWallet;