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
    "walletPrivKey":"L2Fu6TM1AqSNBaQcjgjvYjGf3EzS3MVSTwEeTw3bvy52x7ZkffWj",
    "network": "testnet",
    "secret": "b6f57154-0df8-4845-a61d-47ecd648c2d4:eab5a55d9214845ee8d13ea1033e42ec8d7f780ae6e521d830252a80433e91a5:T",
    "xPrivKey": "tprv8ZgxMBicQKsPfFVXegcKyJjy2Y5DSrHNrtGBHG1f9pPX75QQdHwHGjWUtR7cCUXV7QcCCDon4cieHWTYscy8M7oXwF3qd3ssfBiV9M68bPB",
    "copayerId": "3fc03e7a-6ebc-409b-a4b7-45b14d5a8199",
    "signingPrivKey": "0d3c796fb12e387c4b5a5c566312b2b22fa0553ca041d859e3f0987215ca3a4f",
    "publicKeyRing": []
  }
};

var serverResponse = {
  completeWallet: {
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
  },


  incompleteWallet: {
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
  },

  corruptWallet22: {
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
  },
  corruptWallet222: {
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
};

module.exports.serverResponse = serverResponse;
module.exports.storage = storage;
