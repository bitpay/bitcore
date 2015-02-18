var storage = {
  wallet11: {
    "m": 1,
    "n": 1,
    "walletPrivKey": "{\"bn\":\"6b862ffbfc90a37a2fedbbcfea91c6a4e49f49b6aaa322b6e16c46bfdbe71a38\",\"compressed\":true,\"network\":\"livenet\"}",
    "network": "testnet",
    "xPrivKey": "tprv8ZgxMBicQKsPeisyNJteQXZnb7CnhYc4TVAyxxicXuxMjK1rmaqVq1xnXtbSTPxUKKL9h5xJhUvw1AKfDD3i98A82eJWSYRWYjmPksewFKR",
    "copayerId": "a84daa08-17b5-45ad-84cd-e275f3b07123",
    "signingPrivKey": "42798f82c4ed9ace4d66335165071edf180e70bc0fc08dacb3e35185a2141d5b",
    "publicKeyRing": ["tpubD6NzVbkrYhZ4YBumFxZEowDuA8iirsny2nmmFUkuxBkkZoGdPyf61Waei3tDYvVa1yqW82Xhmmd6oiibeDyM1MS3zTiky7Yg75UEV9oQhFJ"]
  },

  incompleteWallet22: {
    "m": 2,
    "n": 2,
    "walletPrivKey": "L2Fu6TM1AqSNBaQcjgjvYjGf3EzS3MVSTwEeTw3bvy52x7ZkffWj",
    "network": "testnet",
    "secret": "b6f57154-0df8-4845-a61d-47ecd648c2d4:eab5a55d9214845ee8d13ea1033e42ec8d7f780ae6e521d830252a80433e91a5:T",
    "xPrivKey": "tprv8ZgxMBicQKsPfFVXegcKyJjy2Y5DSrHNrtGBHG1f9pPX75QQdHwHGjWUtR7cCUXV7QcCCDon4cieHWTYscy8M7oXwF3qd3ssfBiV9M68bPB",
    "copayerId": "3fc03e7a-6ebc-409b-a4b7-45b14d5a8199",
    "signingPrivKey": "0d3c796fb12e387c4b5a5c566312b2b22fa0553ca041d859e3f0987215ca3a4f",
    "publicKeyRing": []
  },
  complete22: {
    "xPrivKey": "xprv9s21ZrQH143K3nwnRt6W25h7smm4k4nbuN4QKnNkTMDHFcB11wJXYF78TpwQ3xKjik9M66nRd9WUiHB5C8XgoWSbpMRMc2AxpcUNUsi4thi",
    "m": 2,
    "n": 2,
    "publicKeyRing": ["xpub661MyMwAqRbcGzNFbVQLh6CV6ukHuhBn4Bf4CGrQ6pFfNNdJ3pxrEVDtFHGsTzyz6Py23FhP8GWAqew3PsvnstEs2iayH1PK5Mx1bSVSEAG", "xpub661MyMwAqRbcGH2FXudWPDdrRobZ9XWTGaz18AnN1gkG8QW9ZUcn63RcK5qJJ5DXYXeAWBNqprdvvg8VHA5twmBHCUc6gWygXkwmU1Dohwh"],
    "copayerId": "020b41cfea5fae42050580474a195a8385b093f291af4079759851d8819383a680",
    "signingPrivKey": "KyhU3befBaePqHuPQNNyY1XFUgnArR3GUKZpZwV5vS7u1pcR3uzB",
    "sharedEncryptingKey": "ezDRS2NRchMJLf1IWtjL5A==",
    "network": "livenet"
  },
  complete11: {
    "copayerId": "036ed70f51adf14e3e55aba727d28adec1851aff6865552aa9ec9b9dbafecd4a87",
    "xPrivKey": "tprv8ZgxMBicQKsPdjYWSKKh8SuMZAQ6K3J6v5H3A8ZVyyvXk4h1xft3qeRTmCZbxQB77n3ndfF6G4AevqgpiAVuCmZqYURH3wzSQviTvP1nkYN",
    "publicKeyRing": ["tpubD6NzVbkrYhZ4XCaJKxzHXrZU8Bv2UNV1VNspSeboQFivaYwnb4he293KwLPxnNNSBEj3RAE5EEaHqPWatzexGd613hGMLLQz5BEgjtpgWnZ"],
    "network": "testnet",
    "m": 1,
    "n": 1,
    "signingPrivKey": "KxyNf4A1Td61GMrnC6LNQYsfE9zKvgsFmmgkPYrPoJHva4j9YSL1",
    "walletPrivKey": "L4JHs2ZggZkEuRLffH2WVe337nwZWMxytxViLLGyAfGREk6bUCXo",
    "sharedEncryptingKey": "ezDRS2NRchMJLf1IWtjL5A=="
  },
};

var serverResponse = {
  completeWallet: {
    wallet: {
      m: 2,
      n: 2,
      status: 'complete',
      publicKeyRing: ['tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        'tpubD6NzVbkrYhZ4WSuBBLyubi8DHMipbFQcZoLJHjb21gEtznCEJMJhwkvaSshHVLtq8C1uNMKD4GtADVYY6WZt1cyT218JUm3PiNKYVkMATWV'
      ],
      addressIndex: 0,
      copayers: [{
        xPubKey: 'tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        xPubKeySignature: '3045022100ef86122060bbb7681db05486f8b1ee1579c5800e8da78182a87384f05542a4cc0220215ce7ef8c484b64178779414efdf2b7033d25ed752eebf4eb3241f9fa8e6b67',
      }, {
        xPubKey: 'tpubD6NzVbkrYhZ4YiXKYLGvNiQ5bZb9cBUHSBrxZn3xa6BuwZfBFgksTE8M4ZFBLWVJ4PLnAJs2JKhkpJVqsrJEAkGpb62rx62Bk4o4N5Lz8dQ',
        xPubKeySignature: '3045022100e03b069db333428153c306c9bf66ebc7f25e7d7f3d087e1ca7234fbbb1a47efa02207421fb375d0dd7a7f2116301f2cdf1bce88554a6c88a82d4ec9fb37fb6680ae8',
      }],
      pubKey: ' { "x": "b2903ab878ed1316f82b859e9807e23bab3d579175563e1068d2ed9c9e37873c", "y": "5f30165915557394223a58329c1527dfa0f34f483d8aed02e0638f9124dbddef", "compressed": true }',
      network: 'testnet',
    }
  },

  missingMyPubKey: {
    wallet: {
      m: 2,
      n: 2,
      status: 'complete',
      publicKeyRing: ['tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        'tpubD6NzVbkrYhZ4WSuBBLyubi8DHMipbFQcZoLJHjb21gEtznCEJMJhwkvaSshHVLtq8C1uNMKD4GtADVYY6WZt1cyT218JUm3PiNKYVkMATWV'
      ],
      addressIndex: 0,
      copayers: [{
        xPubKey: 'tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        xPubKeySignature: '3045022100ef86122060bbb7681db05486f8b1ee1579c5800e8da78182a87384f05542a4cc0220215ce7ef8c484b64178779414efdf2b7033d25ed752eebf4eb3241f9fa8e6b67',
      }, {
        xPubKey: 'tpubD6NzVbkrYhZ4WSuBBLyubi8DHMipbFQcZoLJHjb21gEtznCEJMJhwkvaSshHVLtq8C1uNMKD4GtADVYY6WZt1cyT218JUm3PiNKYVkMATWV',
        xPubKeySignature: '3044022025c93b418ebdbb66a0f2b21af709420e8ae769bf054f29aaa252cb5417c46a2302205e0c8b931324736b7eea4971a48039614e19abe26e13ab0ef1547aef92b55aab',
      }],
      pubKey: ' { "x": "b2903ab878ed1316f82b859e9807e23bab3d579175563e1068d2ed9c9e37873c", "y": "5f30165915557394223a58329c1527dfa0f34f483d8aed02e0638f9124dbddef", "compressed": true }',
      network: 'testnet',
    }
  },


  incompleteWallet: {
    wallet: {
      m: 2,
      n: 2,
      status: 'pending',
      publicKeyRing: ['tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        'tpubD6NzVbkrYhZ4WSuBBLyubi8DHMipbFQcZoLJHjb21gEtznCEJMJhwkvaSshHVLtq8C1uNMKD4GtADVYY6WZt1cyT218JUm3PiNKYVkMATWV'
      ],
      addressIndex: 0,
      copayers: [{
        xPubKey: 'tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        xPubKeySignature: '3045022100ef86122060bbb7681db05486f8b1ee1579c5800e8da78182a87384f05542a4cc0220215ce7ef8c484b64178779414efdf2b7033d25ed752eebf4eb3241f9fa8e6b67',
      }],
      pubKey: ' { "x": "b2903ab878ed1316f82b859e9807e23bab3d579175563e1068d2ed9c9e37873c", "y": "5f30165915557394223a58329c1527dfa0f34f483d8aed02e0638f9124dbddef", "compressed": true }',
      network: 'testnet',
    }
  },

  corruptWallet22: {
    wallet: {
      m: 2,
      n: 2,
      status: 'complete',
      publicKeyRing: ['tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        'tpubD6NzVbkrYhZ4WSuBBLyubi8DHMipbFQcZoLJHjb21gEtznCEJMJhwkvaSshHVLtq8C1uNMKD4GtADVYY6WZt1cyT218JUm3PiNKYVkMATWV'
      ],
      copayers: [{
        xPubKey: 'tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        xPubKeySignature: '3045022100ef86122060bbb7681db05486f8b1ee1579c5800e8da78182a87384f05542a4cc0220215ce7ef8c484b64178779414efdf2b7033d25ed752eebf4eb3241f9fa8e6b67',
      }, {
        xPubKey: 'tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        xPubKeySignature: 'bababa',
      }],
    }
  },
  corruptWallet222: {
    wallet: {
      m: 2,
      n: 2,
      status: 'complete',
      publicKeyRing: ['tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
        'tpubD6NzVbkrYhZ4WSuBBLyubi8DHMipbFQcZoLJHjb21gEtznCEJMJhwkvaSshHVLtq8C1uNMKD4GtADVYY6WZt1cyT218JUm3PiNKYVkMATWV'
      ],
      copayers: [{
        xPubKey: 'tpubD6NzVbkrYhZ4Y1CGuCZ88eZvhDSTjAqjotZWGXC7e4GEoyXq3SQgZK9iRz4qC2h8MrzqrYBndCMQDiaaLdqpY8ihYmJC9Msvns83jGopb3E',
      }, ],
    }
  },
  pendingTxs: [{
    version: '1.0.0',
    createdOn: 1424287779,
    id: '01424287779165d80a7123-f5c4-4144-ac1b-663220c01c55',
    creatorId: '02da4d1bd797b41a5565fe54f22583051bd3c29dbbc86eedadb6af6e9200af1048',
    toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
    amount: 10000,
    message: '{"iv":"vDH4J15lBiokSP+iUS4ofA==","v":1,"iter":1,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","ct":"X/vPh+vh/Qv8IRSx"}',
    changeAddress: '2Mu4nmHhBWFk766M4yXJi2oyi59HZLKHWqn',
    inputs: [{
      address: '2MvBhgsQX6EusXvNGdcjM5dschDkaos1uuk',
      txid: '006a2915d8f1811620f8b83357869a94c53714f90ce4be4a5ca0d5305a21400d',
      vout: 0,
      scriptPubKey: 'a914203dd60a7659995a6e3bba7caac3c2d684c836ce87',
      amount: 0.1,
      path: 'm/2147483647/0/0',
      publicKeys: ['0371629fe3547002723ef57ad4dae0d97653cf89b0a570637cffca2f23982f0f92']
    }],
    requiredSignatures: 1,
    requiredRejections: 1,
    status: 'pending',
    inputPaths: ['m/2147483647/0/0'],
    actions: {},
    creatorName: 'ematiu'
  }],

};

module.exports.serverResponse = serverResponse;
module.exports.storage = storage;
