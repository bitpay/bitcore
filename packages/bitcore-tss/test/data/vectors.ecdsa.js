const twoOfThree = require('./2of3/index');
const threeOfThree = require('./3of3/index');
const oneOfFour = require('./1of4/index');

module.exports.vectors = [
  {
    m: 2,
    n: 3,
    xPubKey: 'xpub661MyMwAqRbcGvRAUJpL6nMhYqanMb6xT7fJw7au2CxhA4Ye661AS6JHze8vGLdaxsxwmqw7g8iXKJn4TgC4Rzq87GueZbzzv1jz6XMsnr2',
    addresses: [
      { chain: 'ETH', network: 'mainnet', address: '0xD57cF5ac4CC763D83E0892a07a02fE1BBD123b27', path: 'm' },
      { chain: 'ETH', network: 'mainnet', address: '0x8CeAD6bE77E8668016658Ab4a8f6B2B21C7C1959', path: 'm/0/0'},
      { chain: 'BTC', network: 'mainnet', address: 'bc1qlhghx9pt5sj805cx6gwapgdgvvk27uea2nehv2', path: 'm', addressType: 'p2wpkh' },
      { chain: 'BTC', network: 'regtest', address: 'bcrt1qc9ecm64c5hnsn62dj3sswssnlxegk6vqh0qw3x', path: 'm/0/0', addressType: 'p2wpkh' },
      { chain: 'BTC', network: 'regtest', address: 'bcrt1qvyyl7ez48qdyfezmfrk03epekshph5k5fptsf0', path: 'm/0/1', addressType: 'p2wpkh' },
    ],
    party0: {
      seed: Buffer.from('0d18dd84ff2e7e462bdca9fb362dce0590badac80438234a6be4b859d674355d', 'hex'),
      keychain: twoOfThree.party0Key,
      authKey: 'ae6101a4bfcae77c59c4c252d2004996e1f614e17feee932eff82d132d3c4cd1'
    },
    party1: {
      seed: Buffer.from('1cb43de73873a349190d7d0ab5256aa4dba5e8ab1291885086d9db633134ac23', 'hex'),
      keychain: twoOfThree.party1Key,
      authKey: 'b45b008ffc057705f9119411c9fd2bad380b03d3295131834a798545fc5ed9da'
    },
    party2: {
      seed: Buffer.from('202b9dcd66c61bdcb523b65332e5bc4f17805ba991374dfb2a3e9347ec6bd170', 'hex'),
      keychain: twoOfThree.party2Key,
      authKey: 'c0ad56c56bfae6cad2bdba3d96be498515213eb62fdc4a0ee988514eb639841d'
    },
    keygen: {
      messages: {
        round0: {
          party0: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 0,
              payload: {
                message: 'pGdmcm9tX2lkAGpzZXNzaW9uX2lkmCAYqwkFGO0YMhi6GJMY8RjZGKIYuBiMGHUYKBjjGFYYMhhkGK0GGOYYOBiDGMgYahj8GLoYbBiLGGwYRhgwamNvbW1pdG1lbnSYIBg6GCEYvhiuGNgGGGgYoBgxGHYY+xgcGDcHGH4YuhisGK0YZhi2GDQYqgUYwhgsGC0Yvhh6GJwYOhj+GD1jeF9pmCAY1hiNGMAYJhjPGCoYhBMYbBj7GPIYihgnGLsYsBhXGK4YsRhWAhg4GF8Y9hiaGNAY9xhoGGMYTBjXGJ4YSQ==',
                signature: '304402205ab3bd821993cae4be10abc13f459eec466ebf940c4164478f2c9c3686eaab460220693ece4ce558459241256d2f9109e8f3a6fcb9fbe34899ad919c44a1e0d3fb10'
              },
              signatureR: undefined
            }]
          },
          party1: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 1,
              payload: {
                message: 'pGdmcm9tX2lkAWpzZXNzaW9uX2lkmCAYcA0YhBh1GKwY3hguExiSGKsY8xhZGIMYyRiDGPMYthiuGOMYcxj2GCAYlBjbGGAYHBhbGF8YjBjIGO0YKWpjb21taXRtZW50mCAYqBibGNAYHRisGO0Y0RglGLYYrBgsGLAYsBi+GE4YKRhmGCgYZRjNGPEY8RjUGPkYMRjPGN0YfhjeGFkYeQNjeF9pmCAPGGUYVgYYvBj6GKYYwhjfGHEYYxiAGLAY8xg8GCAYzBg2GIsYbQ4YIRgzGGMLGJMYdRi0Exj5GFMYxg==',
                signature: '3045022100c0c98bc13362a36ee0f7750f378a93717e1e8c820c1bb7b915ce39b3604861e402200781fc0140f84c4aa82d2ef0b8c475f85efa4228e8d0e4eb2c0fa5f012907df6'
              },
              signatureR: undefined
            }]
          },
          party2: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 2,
              payload: {
                message: 'pGdmcm9tX2lkAmpzZXNzaW9uX2lkmCACGI8YJBiRGLIYWRjJGKsY5RhqFBi0GEAYYwEYbRjNGB8YOxiDGMAYRxitGEMYJhg6GN8YNRiVGI8YkBggamNvbW1pdG1lbnSYIBgxGJEYWRgjGPQY/hj3GLYYURg9GNgYjgcYSxjEGLEYWA0YhxgoGCgCGEkY7hjGGJUY/xgxGPkYKxiCGJ5jeF9pmCAYJRj1GLEYrhhmGCoY1hggGIMYORgbGBkY5xIYtBhcGLAYdRjfGIMYPhjCGB0Y5BglGIYRGNEYhBEYjhgs',
                signature: '304402200e21a04f466fbb3b79395a636adfbb0b457fa277bb6a6b03a8e0692d072a3e24022021f0b6da62772c5ac413abf017c7bbea4219ae6ef930215a7d73e7df13ed34c0'
              },
              signatureR: undefined
            }]
          },
        },
        round1: {
          party0: {
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round2: {
          party0: {
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round3: {
          party0: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 0,
                payload: {
                  message: "pGdmcm9tX2lkAGpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxi9GJ8YmhiqGGcYIBj2GKUYhxjpGDQYohhYGIAYWwwYpBjHGFkYxBiaGMoY6BjUGPwY2hgmGP0YgBgiExibZXByb29momF0mCEDGMkYQRgkGEcYMRhxGP0Y4xigGJAYSRgpGJAYnBhGGKUYkBifGJkY8Rh+GCsYsxirGIcMGPAYiBjjGLEY9xhMYXOYIBhKGOMYnhi7ERjrGKYYTBIYPRiQGHIYURhLGOkYixicGJMJGLEY7xisGF8YeBicGE0IFwoIGC8YVA==",
                  signature: "3045022100e7d1209ab8463ba6af71d0df953eaecd7cf1cbb06f7a5f4f0bacde9cd555cf310220220251083ea1d6453ff376a5520f87b9f6fe2c1fa099d034453aa41b81e54f9c",
                },
                signatureR: undefined,
              },
            ],
          },
          party1: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 1,
                payload: {
                  message: 'pGdmcm9tX2lkAWpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxizGJsYlBjXGJkYzRiXGFQYuBg7GOwYVRiuGPkYOhhOGHUYaxgnGK8Y4xi2GCgY/xhWGEYHGOIYIBidGOkAZXByb29momF0mCEDGCgYVhioGKYYUQ0YnRj9GDIYQBiHGMAYvBjOFBhSGJwYohgrGBkYgRibGKsY0RjYGJYYGRjYGJ0YXBgbGCBhc5ggGLkY9hg7GEYYORjIARhwGNQYzhg/GEUYpxiGGOEY+hijGJgYthgjGOEYpRh0CxjRGCASGI8YghjDDxiF',
                  signature: '3045022100cde18dafab8cf3ced5a6df4374de498a41b273eeb929c9a5f2d316352cec7d2202200ab38847d3114321edd49a5ec2bb52ab6b27344d4719ef54ae48f98482061f0d',
                },
                signatureR: undefined,
              },
            ],
          },
          party2: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 2,
                payload: {
                  message: 'pGdmcm9tX2lkAmpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxjvGIMYqhiPGI8YcRinGPYYXRjMGF0YegcYZxjJGMgKGHoYoRhnGNYYwBiHGOoYlBjvGN8YyBgsGEcYKhgqZXByb29momF0mCEDGPUYzxjiGLkYjxj+GEAYZgkYQxi+GLgYGxgyGEIKGLgYywwKGDEYxRhVGN0YUhigGL8Y+wYYSRguGPxhc5ggGCwYxRieGG0Y3xjwGIkQGDQY1hhJGJ0Y1xgsGNcY8hixGMQY+hiQGJ8Y9xgYGM8YtBhPGG0RGPgYcBgyGJs=',
                  signature: '304402203e9ca032e88a0c9e508a2b24fd421a9c84eb227cd9c82acf4f04f623e9318eba02201bb3b907b3a6b6023bed4198217dd9c42a1d9798aae475773a4d48e3870da625',
                },
                signatureR: undefined,
              },
            ],
          }
        }
      }
    },
    signing: [{
      description: 'Sign Ethereum transaction',
      derivationPath: 'm',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea'
    }, {
      description: 'Sign Ethereum transaction with path m/0/0',
      derivationPath: 'm/0/0',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea'
    }, {
      description: 'Sign Bitcoin transaction - P2WPKH',
      derivationPath: 'm/0/0',
      chain: 'BTC',
      rawTx: '0200000001b61247a9a96f3c705e580135066d7924cebe918a42e37f122e46d416966007760000000000ffffffff02d2040000000000001600146109ff6455381a44e45b48ecf8e439b42e1bd2d47ea5f505000000001600146109ff6455381a44e45b48ecf8e439b42e1bd2d400000000',
      inputIndex: 0,
      utxo: {
        txid: '7607609616d4462e127fe3428a91bece24796d063501585e703c6fa9a94712b6',
        vout: 0,
        satoshis: 1e8,
        script: '0014c1738deab8a5e709e94d9461074213f9b28b6980',
      },
      messageHash: '0fa198ad9d2ea9c4023835f2387b2b0d016281fee4a268eb2c9d6a9dc84ced42'
    }]
  },
  {
    m: 3,
    n: 3,
    xPubKey: 'xpub661MyMwAqRbcGMxfc55KDe3yBDLATHWyyERQuybvR7umom3z8QAQB9q2zDB1GQcnvcJfhiytC5sBxt8HsGLq3823rvNMEdp2sRZWHCpbvow',
    addresses: [
      { chain: 'ETH', network: 'mainnet', address: '0xD57cF5ac4CC763D83E0892a07a02fE1BBD123b27', path: 'm' },
      { chain: 'ETH', network: 'mainnet', address: '0x52992F2D78E26663001890955513cC0D63D78191', path: 'm/0/0' },
      { chain: 'BTC', network: 'mainnet', address: 'bc1qlhghx9pt5sj805cx6gwapgdgvvk27uea2nehv2', path: 'm', addressType: 'p2wpkh' },
      { chain: 'BTC', network: 'regtest', address: 'mrRVfitL15jjH1kEuUvrsX6YqSSdigQZw1', path: 'm/1/40', addressType: 'p2pkh' },
      { chain: 'BTC', network: 'regtest', address: 'mhYp1a6gMGecCncXY6wAGPT7UdKTe5qRzT', path: 'm/1/41', addressType: 'p2pkh' },
    ],
    party0: {
      seed: Buffer.from('0d18dd84ff2e7e462bdca9fb362dce0590badac80438234a6be4b859d674355d', 'hex'),
      keychain: threeOfThree.party0Key,
      authKey: 'ae6101a4bfcae77c59c4c252d2004996e1f614e17feee932eff82d132d3c4cd1'
    },
    party1: {
      seed: Buffer.from('1cb43de73873a349190d7d0ab5256aa4dba5e8ab1291885086d9db633134ac23', 'hex'),
      keychain: threeOfThree.party1Key,
      authKey: 'b45b008ffc057705f9119411c9fd2bad380b03d3295131834a798545fc5ed9da'
    },
    party2: {
      seed: Buffer.from('202b9dcd66c61bdcb523b65332e5bc4f17805ba991374dfb2a3e9347ec6bd170', 'hex'),
      keychain: threeOfThree.party2Key,
      authKey: 'c0ad56c56bfae6cad2bdba3d96be498515213eb62fdc4a0ee988514eb639841d'
    },
    keygen: {
      messages: {
        round0: {
          party0: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 0,
              payload: {
                message: 'pGdmcm9tX2lkAGpzZXNzaW9uX2lkmCAYqwkFGO0YMhi6GJMY8RjZGKIYuBiMGHUYKBjjGFYYMhhkGK0GGOYYOBiDGMgYahj8GLoYbBiLGGwYRhgwamNvbW1pdG1lbnSYIBj9GGUYZhiAGOoYThj0AxiLGH8YZhhbGNcYSBhSGM8YbxgpGCsYvxhxGO0YmxgiGMsYgAoYzxjZGNEYhwNjeF9pmCAYkRiQGDQY2hh4GGoYuBjJGMUYUxhnARhdGFQYHxhlGHoIGPIYSxi/GOcYrRjeGFoY4BjiGNkYQBinGCIY4g==',
                signature: '3045022100ee3de12a4dd4fc95096370d3529f1f88172edd6114af5bfe7d36ae07ce8c930c02207be061ee516edac0434edfc431db5f1b32f722b704c69c85400ba3c215e2c2a8'
              },
              signatureR: undefined
            }]
          },
          party1: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 1,
              payload: {
                message: 'pGdmcm9tX2lkAWpzZXNzaW9uX2lkmCAYcA0YhBh1GKwY3hguExiSGKsY8xhZGIMYyRiDGPMYthiuGOMYcxj2GCAYlBjbGGAYHBhbGF8YjBjIGO0YKWpjb21taXRtZW50mCAYMRi2GMwYGhjSGIAFGC8Y/xhBGEIYVBg1GP0YOBjCGHUYxxiZGM4Y/RhhGJAYTRijGL8Y2hjcGIEY2BhhGGZjeF9pmCAYgBiUGMgY2hhhGEwJGFwYJhgjGH0YfhiVDBjwFRi2GDIYwxgfGJcYKBjwGD4YNhhSExhyGFsYVhiGGP4=',
                signature: '30440220784971f7a3f4e410eb6ea28fc3bb5050d78bc76921dc89f4f025dfd3ed0eaa4802207b2cd01ef1e93f653fff75e2e5bb934bd989942a78036ac836bc0f779963763c'
              },
              signatureR: undefined
            }]
          },
          party2: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 2,
              payload: {
                message: 'pGdmcm9tX2lkAmpzZXNzaW9uX2lkmCACGI8YJBiRGLIYWRjJGKsY5RhqFBi0GEAYYwEYbRjNGB8YOxiDGMAYRxitGEMYJhg6GN8YNRiVGI8YkBggamNvbW1pdG1lbnSYIBhfGO8YqRhbGL8Y5BhBGPkYIBjKGKAXGDAYIBgiGKIY+RjQDRifGCIYnRjRGCgYQRjYGJYY0xh1GGIYMRg3Y3hfaZggGO8YbBj+GL0Y2wMYxBi0GLYYmRjoGFsYHAgYaxjpGIIYKBgpGMgYiBiTGNEYQBhpFRgmGPEYyRjeGLMYuQ==',
                signature: '3044022011762265201765d3fd92da3b61de754e6dfc4687d986fcfb61abfb102ed42464022042a14d3ba2ccd8d71e10e06efb1fd87787a4f6f02495dcf21964cd105a1983b6'
              },
              signatureR: undefined
            }]
          },
        },
        round1: {
          party0: {
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: 'e5f266a536b7e0f33b9a8d1db3ac3736bc7abf897940b5ec7dc654d04f2287d1',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: 'e5f266a536b7e0f33b9a8d1db3ac3736bc7abf897940b5ec7dc654d04f2287d1',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: '6117b268e187d7f85d744c5d2cd678f9c929d95aec0c994c7a80b492bfc960c0',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: '6117b268e187d7f85d744c5d2cd678f9c929d95aec0c994c7a80b492bfc960c0',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: '01c979151bc461d0fd9d267c8ea659f818b6d3d38f5c193270a6681993e86da6',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: '01c979151bc461d0fd9d267c8ea659f818b6d3d38f5c193270a6681993e86da6',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round2: {
          party0: {
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: 'e5f266a536b7e0f33b9a8d1db3ac3736bc7abf897940b5ec7dc654d04f2287d1',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: 'e5f266a536b7e0f33b9a8d1db3ac3736bc7abf897940b5ec7dc654d04f2287d1',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: '6117b268e187d7f85d744c5d2cd678f9c929d95aec0c994c7a80b492bfc960c0',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: '6117b268e187d7f85d744c5d2cd678f9c929d95aec0c994c7a80b492bfc960c0',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: '01c979151bc461d0fd9d267c8ea659f818b6d3d38f5c193270a6681993e86da6',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: '01c979151bc461d0fd9d267c8ea659f818b6d3d38f5c193270a6681993e86da6',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round3: {
          party0: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 0,
                payload: {
                  message: "pGdmcm9tX2lkAGpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAhhHGEcY4BhBGIgYlwEXGHoYVxhNGIgYUxjqGI4Y/RiUGIgYZhicBRhwGIUYThhmGPsYtRhLGEsY7xj8GIBlcHJvb2aiYXSYIQMSGC4XGGYY8xgnEA4YRxgyGEUYGxjfGNcYuAwLGKAY0xinCBi+GBgYKhiTGDUY4BiwGNoYLxiIGNVhc5ggGIYXGC0Y5RimGFwYehjcBgMY2hi5GCoYywEYyRgbGC0KGEcEBgAY0BjHGM4Y3RjEGFoY5hgqGCM=",
                  signature: "3045022100a53a76558f8bafc971d1fb6996853bfd8aed870ce93803d3b4ecfb042827cf3b022039642622fcf5d5e7825a62ab2c9b1b6e62e99648968c69f8cb1a26b10b2f405a",
                },
                signatureR: undefined,
              },
            ],
          },
          party1: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 1,
                payload: {
                  message: 'pGdmcm9tX2lkAWpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAwcY1RiMGGIYRxg9GI4FGFQY1xjqGDUYxxjbGDkYUBjQGPsYHxi+GCMYwxgtGOUYrBiRGBgYrhiMGC8YNBhAZXByb29momF0mCEDGMUYcRiRGHUY4xhCGOUYihj6GG0Y9xiRChhWGMAWGIcYqhiXGL8YtxhHGGIYTxitGNAYJxjtGIMQGKoYI2FzmCAYhxiNGPMYHhjIGMkY4Bi2GKsYWRjhGK0YTRgyGJkYLhi1GMsYqxifGD0Yoxg3GJ8YjRjQGPQY7RhJGJYYXxjT',
                  signature: '3045022100c8d4edd137b6161dcfe2990d2457b130873e454944a68f61f426c6203ec8497702201834771204496586ba946d1d40bcf5bd37f347828b2d95184828ca10772c4cf2',
                },
                signatureR: undefined,
              },
            ],
          },
          party2: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 2,
                payload: {
                  message: 'pGdmcm9tX2lkAmpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAhiqGJEY1xjNGDMYrhjNGJQYfBinGHUHGPYYqxgrGPcYuhgaGGUYyBhOGM8YfRiJGC4YOhh0GI8YyAwYdRisZXByb29momF0mCEDDhjjGLcYfhhdGLsPGKcYkBg/GNoYoRj9GCgYvBglDBhNGJ8YYBjEGGYYohhAGEQYaxjmGIgY4RhKGJIYbWFzmCAYiBhAGI4Y5RinGJ8YWRjWGIYYHxh/GKYYtBghGLIWGEcYnBhyGI8YnQ8YfRg0GKAFAxjDGMgY7hhXGOc=',
                  signature: '304402205964a502b0e492995bd3a913c3de99850100c7290f3d88ea0575140d5f0268fa0220597a7be72c664ffa15fdcf2117b4b6468d67a48de40f2ea9a3df8375705e3139',
                },
                signatureR: undefined,
              },
            ],
          }
        }
      }
    },
    signing: [{
      description: 'Sign Ethereum transaction',
      derivationPath: 'm',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea'
    }, {
      description: 'Sign Ethereum transaction with path m/0/0',
      derivationPath: 'm/0/0',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea'
    }, {
      description: 'Sign Bitcoin transaction - P2PKH',
      derivationPath: 'm/1/40',
      chain: 'BTC',
      rawTx: '0200000001e61f9791fe02162402d12e1d44390e186844f85036fb1855ad70bc912f6446f20100000000ffffffff02b315000000000000160014aeb0c7630e772935abc2bfd4df72aa7d348417273155eb0b000000001976a914164a2b0f704dfb6784c9b6ccd1b5538463da93d388ac00000000',
      inputIndex: 0,
      utxo: {
        txid: 'f246642f91bc70ad5518fb3650f84468180e39441d2ed102241602fe91971fe6',
        vout: 1,
        satoshis: 2e8,
        script: '76a91477a113c462f6ba094df1d634062af86dfd6011b688ac'
      },
      messageHash: '946a6f991455ae95e8dc66aa611feb53ac3b54ddbe93c442c950c859f5647773'
    }]
  },
  {
    m: 1,
    n: 4,
    xPubKey: 'xpub661MyMwAqRbcEdUKkUS4CfQNmWXn74P1HM9GPsKtkhgFL6GfJNH4QZJ9XeYibd6mtCn35yzsx5i2BQXY9Tqd6YPaXaMsbnpmBw9AWuNwNCB',
    addresses: [
      { chain: 'ETH', network: 'mainnet', address: '0xEa08Bdc953DFd1Fd017c3Bb17B781Be13A830aD7', path: 'm' },
      { chain: 'ETH', network: 'mainnet', address: '0x7C686844e293ff19b6BF12AA4980206d30071214', path: 'm/0/0' },
      { chain: 'BTC', network: 'mainnet', address: 'bc1q566z27mx3x9qjmg0s2gjxptwj5wqn3cddnrgm2', path: 'm', addressType: 'p2wpkh' },
      { chain: 'BTC', network: 'regtest', address: '2N7USY6j69pjMrvLgX8i3nyRZYXxYoEzsD9', path: 'm/0/510/0', addressType: 'p2sh' },
      { chain: 'BTC', network: 'regtest', address: '2MxSNgvwjoYAWB824as56kkXxo8dhKpXnN3', path: 'm/0/510/1', addressType: 'p2sh' },
    ],
    party0: {
      seed: Buffer.from('0d18dd84ff2e7e462bdca9fb362dce0590badac80438234a6be4b859d674355d', 'hex'),
      keychain: oneOfFour.party0Key,
      authKey: 'ae6101a4bfcae77c59c4c252d2004996e1f614e17feee932eff82d132d3c4cd1'
    },
    party1: {
      seed: Buffer.from('1cb43de73873a349190d7d0ab5256aa4dba5e8ab1291885086d9db633134ac23', 'hex'),
      keychain: oneOfFour.party1Key,
      authKey: 'b45b008ffc057705f9119411c9fd2bad380b03d3295131834a798545fc5ed9da'
    },
    party2: {
      seed: Buffer.from('202b9dcd66c61bdcb523b65332e5bc4f17805ba991374dfb2a3e9347ec6bd170', 'hex'),
      keychain: oneOfFour.party2Key,
      authKey: 'c0ad56c56bfae6cad2bdba3d96be498515213eb62fdc4a0ee988514eb639841d'
    },
    party3: {
      seed: Buffer.from('3cd97b3c6d140fa371ee23728a4fa3c89e4cefcd3e57849505ad09538639ca1e', 'hex'),
      keychain: oneOfFour.party3Key,
      authKey: 'da80d5dbc9211963b664752fb012b476b9c019fcdc4347e62a1832763fbd0cc3'
    },
    keygen: {
      messages: {
        round0: {
          party0: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 0,
              payload: {
                message: 'pGdmcm9tX2lkAGpzZXNzaW9uX2lkmCAYqwkFGO0YMhi6GJMY8RjZGKIYuBiMGHUYKBjjGFYYMhhkGK0GGOYYOBiDGMgYahj8GLoYbBiLGGwYRhgwamNvbW1pdG1lbnSYIBhBGGIY6BigGIsYoBgoGHUY7BhyGJgYMxhmGN8YvBhDDRigGLsGGKIYjBg0GP0YmhjTGEIYohjoGPUY9xjLY3hfaZggGMMYMRibGMwYtwMY8RiaGMwYkxgeGFsYnBg4GHcCGCQY2hjyGFcYdhhXGMwYyhh0GIcYnQEIGJsYvxhX',
                signature: '3045022100974c7ead45ed445bc8ab968b13d5bd371fb978d0902a49c4f24e54012519eb3f02200650591e7fb3b0077f574e32c8cf2200c55db7f6d03c9f7ecc9e5460be655db8'
              },
              signatureR: undefined
            }]
          },
          party1: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 1,
              payload: {
                message: 'pGdmcm9tX2lkAWpzZXNzaW9uX2lkmCAYcA0YhBh1GKwY3hguExiSGKsY8xhZGIMYyRiDGPMYthiuGOMYcxj2GCAYlBjbGGAYHBhbGF8YjBjIGO0YKWpjb21taXRtZW50mCAYkRj4GJ8Y6hhdGE0YjhiyGLQYkRg/DQsYbxhnGHUYRRjpGMoYxgoYeRinGOoYeRhPGHgYxxj+GE8Y6xjrY3hfaZggGIYYPxhUGOsYhhhEGOcYLhheGOAYjBh/GIkYdRicGPYY8xjkGMAYzRiTDRjXGIwHGDUYSRhFGM0YIRhjGPQ=',
                signature: '30440220098b25f68b5831cdf9f4f7d4aa726e23747f036b04f1228229fdca8cad150a5702207396fe65fe67d6cff7e6102c98c6ba40e348d4b99a1eef811f72590524a84a69'
              },
              signatureR: undefined
            }]
          },
          party2: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 2,
              payload: {
                message: 'pGdmcm9tX2lkAmpzZXNzaW9uX2lkmCACGI8YJBiRGLIYWRjJGKsY5RhqFBi0GEAYYwEYbRjNGB8YOxiDGMAYRxitGEMYJhg6GN8YNRiVGI8YkBggamNvbW1pdG1lbnSYIBhCGCYYphh5BBgzGCIYYhgpGB8YMxjyEBiWGPgYiBjMGPgYkhgvGGgYiRiHGH4YUBiJGK4YNxi7GJAY8hj8Y3hfaZggGL4IGDkYaRiaGP4Y6AgYchjPGEAYfBjgGGsYuRhPGD0YaBg/GGYY9BhQGF8YzxgvGKQYVwQY/QUYShih',
                signature: '3045022100bbb3f91bb9278cabf370d1245fc9c527ea89c4e61d3b10abd0f1a5783919b19202202d129ebe139979dfa8c9389485cc63198040fe58d3c2e3084af9062b725ebb4b'
              },
              signatureR: undefined
            }]
          },
          party3: {
            p2pMessages: [],
            broadcastMessages: [{
              from: 2,
              payload: {
                message: 'pGdmcm9tX2lkA2pzZXNzaW9uX2lkmCAYshh8GMgYOBiZGEoYqBjlFhhFGLYYRBjZGIoY4BjuGHwYchjsGK8Y8BjRGPAYpRg8GCkYahg6GGIYPhj7GLlqY29tbWl0bWVudJggGN4YNRh9GPAYKhiFGH4YORg4FBjhCxjbGCQVGCEYZhiOGO8YShhPGJ0Y5hiwGIAYZhiMGDIYLhieGHUYU2N4X2mYIBiwGFsY6A0YJRiyEhhuGPkYahhPGLsY6RhtGFkY9hhyGKMYRxgwGO0Y6Bi0GLgY6BjxGE4YUQgYWRgaGHQ=',
                signature: '3045022100ec2ef4b71fcc85725a5ddf13b58370903f856550fa60ba2aafd881c802f04cc1022066edc99cce0bba9d3cce1c137f4612c2af0b3ec224592631bed475666f597284'
              },
              signatureR: undefined
            }]
          },
        },
        round1: {
          party0: {
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: '5ddfeba53cc6056f878307c5a74f38d71fa082cc20545e5aa253673c032f09a4',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: '5ddfeba53cc6056f878307c5a74f38d71fa082cc20545e5aa253673c032f09a4',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 3,
              commitment: '5ddfeba53cc6056f878307c5a74f38d71fa082cc20545e5aa253673c032f09a4',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: 'acdf7fca0fc6342af5a916e3fd5fa3fbc4ee40014a18102190609c9dbd1ebe95',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: 'acdf7fca0fc6342af5a916e3fd5fa3fbc4ee40014a18102190609c9dbd1ebe95',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 3,
              commitment: 'acdf7fca0fc6342af5a916e3fd5fa3fbc4ee40014a18102190609c9dbd1ebe95',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: 'e7c96b5fd6b314d86c648b57fc3ab39e8bcaefd15a1769bcfe3cb74612bdfc34',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: 'e7c96b5fd6b314d86c648b57fc3ab39e8bcaefd15a1769bcfe3cb74612bdfc34',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 3,
              commitment: 'e7c96b5fd6b314d86c648b57fc3ab39e8bcaefd15a1769bcfe3cb74612bdfc34',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party3: {
            p2pMessages: [{
              from: 3,
              to: 0,
              commitment: '7a1c1d2ef9018a9724dd5d0db19f1924f9cada44ef987753ed121eb86ed43dcd',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 3,
              to: 1,
              commitment: '7a1c1d2ef9018a9724dd5d0db19f1924f9cada44ef987753ed121eb86ed43dcd',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 3,
              to: 2,
              commitment: '7a1c1d2ef9018a9724dd5d0db19f1924f9cada44ef987753ed121eb86ed43dcd',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round2: {
          party0: {
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: '5ddfeba53cc6056f878307c5a74f38d71fa082cc20545e5aa253673c032f09a4',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: '5ddfeba53cc6056f878307c5a74f38d71fa082cc20545e5aa253673c032f09a4',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 3,
              commitment: '5ddfeba53cc6056f878307c5a74f38d71fa082cc20545e5aa253673c032f09a4',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: 'acdf7fca0fc6342af5a916e3fd5fa3fbc4ee40014a18102190609c9dbd1ebe95',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: 'acdf7fca0fc6342af5a916e3fd5fa3fbc4ee40014a18102190609c9dbd1ebe95',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 3,
              commitment: 'acdf7fca0fc6342af5a916e3fd5fa3fbc4ee40014a18102190609c9dbd1ebe95',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: 'e7c96b5fd6b314d86c648b57fc3ab39e8bcaefd15a1769bcfe3cb74612bdfc34',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: 'e7c96b5fd6b314d86c648b57fc3ab39e8bcaefd15a1769bcfe3cb74612bdfc34',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 3,
              commitment: 'e7c96b5fd6b314d86c648b57fc3ab39e8bcaefd15a1769bcfe3cb74612bdfc34',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party3: {
            p2pMessages: [{
              from: 3,
              to: 0,
              commitment: '7a1c1d2ef9018a9724dd5d0db19f1924f9cada44ef987753ed121eb86ed43dcd',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 3,
              to: 1,
              commitment: '7a1c1d2ef9018a9724dd5d0db19f1924f9cada44ef987753ed121eb86ed43dcd',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 3,
              to: 2,
              commitment: '7a1c1d2ef9018a9724dd5d0db19f1924f9cada44ef987753ed121eb86ed43dcd',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round3: {
          party0: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 0,
                payload: {
                  message: 'pGdmcm9tX2lkAGpwdWJsaWNfa2V5mCECGPkYjBhOGDwY2xgzGCQYURhdGIkYnRiNGIIYww4YQBjOGGEYNRj4GLIY3xjXGOUYbRh4GH0YMxhGGGcQGO5nYmlnX3NfaZghAhj5GIwYThg8GNsYMxgkGFEYXRiJGJ0YjRiCGMMOGEAYzhhhGDUY+BiyGN8Y1xjlGG0YeBh9GDMYRhhnEBjuZXByb29momF0mCEDGEIY2BjLGD4YcRi4GLMYtxglGEAYfRhpGFAGGEQYYxi7CRgdGFIYJREY+BgxGMQYwBjKGC0YdRgzGPEYpWFzmCAY0xj4GIIYthiDGJkYphizGFAYZRjKGNYYLhijGPwYfBjpGO0IGLIY+REYQBh6GGsY+hhxGLYYqxjzGJcV',
                  signature: '3045022100efba33f53bd109ab320516e20740ef7a99a0ef7f00a1c02b29df577d50cb3a8f0220313c1cab20df32a85a299f79e0bd3cbf98c869dce2063340bd16ac1bd2a3bab9',
                },
                signatureR: undefined,
              },
            ],
          },
          party1: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 1,
                payload: {
                  message: 'pGdmcm9tX2lkAWpwdWJsaWNfa2V5mCECGPkYjBhOGDwY2xgzGCQYURhdGIkYnRiNGIIYww4YQBjOGGEYNRj4GLIY3xjXGOUYbRh4GH0YMxhGGGcQGO5nYmlnX3NfaZghAhj5GIwYThg8GNsYMxgkGFEYXRiJGJ0YjRiCGMMOGEAYzhhhGDUY+BiyGN8Y1xjlGG0YeBh9GDMYRhhnEBjuZXByb29momF0mCECGNwYthihGKYY6BjhGNYYShjjGIQYwBhGGNMYmxhLEhgzEQwYvhipGF8Y2BjiGO4Y3hgbGFgYOBixGG0YIWFzmCAYXhjgGBsYYRiZGMMYcgQYPRiiGOMY2Q0YfhiYGKgYdRi9GIwYYhjFGLoYOgsYpBg0GHcYhhgYGFgYmhh8',
                  signature: '304402204f6fe6ef050140bb6a41c552a91393f4565b49e51f6f43586b718a547fd3596d02203c5ec829c54cf615ff8f49065d30fbe206778a90f917c7dfdc161ee7cf3cdb4a',
                },
                signatureR: undefined,
              },
            ],
          },
          party2: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 2,
                payload: {
                  message: 'pGdmcm9tX2lkAmpwdWJsaWNfa2V5mCECGPkYjBhOGDwY2xgzGCQYURhdGIkYnRiNGIIYww4YQBjOGGEYNRj4GLIY3xjXGOUYbRh4GH0YMxhGGGcQGO5nYmlnX3NfaZghAhj5GIwYThg8GNsYMxgkGFEYXRiJGJ0YjRiCGMMOGEAYzhhhGDUY+BiyGN8Y1xjlGG0YeBh9GDMYRhhnEBjuZXByb29momF0mCEDGB8Y6xheGOsY0A0YdhgzGGMYYhjYGI8Y6BiBGN8YRximGPsSGM8YqBggGHsYihjZGMcYGRiZARgpGH8Y12FzmCAYuBj5GH0YhhjBGNwYoBiaGHcYLxhQGJkY1RgwGEcSGLkYkRjOGD4YvxjRGIYEGO4MGCkYrBhlGFEYMxgy',
                  signature: '3045022100aa164927ed91bf7ce6f9069e1e0599d945831c5fa0bc1b2e097fb4157bbdff240220508ba069fc9949782439178f4728e7ee6e832d606db0e205a88557d4d98c54e4',
                },
                signatureR: undefined,
              },
            ],
          },
          party3: {
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 2,
                payload: {
                  message: 'pGdmcm9tX2lkA2pwdWJsaWNfa2V5mCECGPkYjBhOGDwY2xgzGCQYURhdGIkYnRiNGIIYww4YQBjOGGEYNRj4GLIY3xjXGOUYbRh4GH0YMxhGGGcQGO5nYmlnX3NfaZghAhj5GIwYThg8GNsYMxgkGFEYXRiJGJ0YjRiCGMMOGEAYzhhhGDUY+BiyGN8Y1xjlGG0YeBh9GDMYRhhnEBjuZXByb29momF0mCEDBBimGMQYrRMYsxjsGJYYsxjeGGYY4xi2GLEBGDoYPBglGJsY7RhfGCkYLhjtGJwYNRioGIwYQBgwBBjWYXOYIBjbGLgXGEgYpxjMChiFChglGOUYeRjpGMQYGBhrGMMY+BgsGGwY/RjdGG4YdxjuGHwYsRg/GKwYZxh7GD8=',
                  signature: '3044022068d225b22d917e3246be32c117189de0ef86339652ac9a0796b17387202d95ef022028e64fde56555c648bb9b412ef56ae435b0d3d8455790feb6fb0ae81ab9974c1',
                },
                signatureR: undefined,
              },
            ],
          }
        }
      }
    },
    signing: [{
      description: 'Sign Ethereum transaction',
      derivationPath: 'm',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea' // keccak256(rawTx)
    }, {
      description: 'Sign Ethereum transaction with path m/0/0',
      derivationPath: 'm/0/0',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea' // keccak256(rawTx)
    }, {
      description: 'Sign Bitcoin transaction - P2SH',
      derivationPath: 'm/0/510/0',
      chain: 'BTC',
      rawTx: '0200000001ce3f4e8a68701d3adb36ded86d56ba88eef3611d66bedd3728a6d03fe58fcdef0000000000ffffffff0280f0fa02000000001600146109ff6455381a44e45b48ecf8e439b42e1bd2d4f0a0f5050000000017a91438f477b28db3e712bde2f3676f7b179952a8ab2f8700000000',
      inputIndex: 0,
      utxo: {
        txid: 'efcd8fe53fd0a62837ddbe661d61f3ee88ba566dd8de36db3a1d70688a4e3fce',
        vout: 0,
        satoshis: 1.5e8,
        script: 'a9149c11a4baafa7035755d8f95125622c70b708575187'
      },
      messageHash: 'f11ae75811487a306ee19c246a41307843302a33d96cb25ac1b36f5a4c274192'
    }]
  }
];