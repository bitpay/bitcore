
var exports = {}

exports.history = [{
  txid: "0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04",
  vin: [{
    txid: "c8e221141e8bb60977896561b77fa59d6dacfcc10db82bf6f5f923048b11c70d",
    vout: 0,
    n: 0,
    addr: "2N6Zutg26LEC4iYVxi7SHhopVLP1iZPU1rZ",
    valueSat: 485645,
    value: 0.00485645,
  }, {
    txid: "6e599eea3e2898b91087eb87e041c5d8dec5362447a8efba185ed593f6dc64c0",
    vout: 1,
    n: 1,
    addr: "2MyqmcWjmVxW8i39wdk1CVPdEqKyFSY9H1S",
    valueSat: 885590,
    value: 0.0088559,
  }],
  vout: [{
    value: "0.00045753",
    n: 0,
    scriptPubKey: {
      addresses: [
        "2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V"
      ]
    },
  }, {
    value: "0.01300000",
    n: 1,
    scriptPubKey: {
      addresses: [
        "mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE"
      ]
    }
  }],
  time: 1424471041,
  blocktime: 20,
  valueOut: 0.01345753,
  valueIn: 0.01371235,
  fees: 0.00025482
}, {
  txid: "fad88682ccd2ff34cac6f7355fe9ecd8addd9ef167e3788455972010e0d9d0de",
  vin: [{
    txid: "0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04",
    vout: 0,
    n: 0,
    addr: "2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V",
    valueSat: 45753,
    value: 0.00045753,
  }],
  vout: [{
    value: "0.00011454",
    n: 0,
    scriptPubKey: {
      addresses: [
        "2N7GT7XaN637eBFMmeczton2aZz5rfRdZso"
      ]
    }
  }, {
    value: "0.00020000",
    n: 1,
    scriptPubKey: {
      addresses: [
        "mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE"
      ]
    }
  }],
  firstSeenTs: 1424472242,
  blocktime: 10,
  valueOut: 0.00031454,
  valueIn: 0.00045753,
  fees: 0.00014299
}];



exports.payProJsonBody = body = {
  bch: '{"network":"test","currency":"BCH","requiredFeeRate":1.398,"outputs":[{"amount":769200,"address":"qz78y0832kskq84rr4f9t22fequ5c0l4gu6wsehezr"}],"time":"2019-03-07T18:05:44.301Z","expires":"2019-03-07T18:20:44.301Z","memo":"Payment request for BitPay invoice 3oZcpotopVGcZ2stRw2dop for merchant GusPay","paymentUrl":"https://test.bitpay.com/i/3oZcpotopVGcZ2stRw2dop","paymentId":"3oZcpotopVGcZ2stRw2dop"}',
  btc: '{"network":"main","currency":"BTC","requiredFeeRate":27.001,"outputs":[{"amount":1004800,"address":"1MR4ucgpxum2iPYCixX77Qi9rR4im3ccsx"}],"time":"2019-03-08T15:27:43.684Z","expires":"2019-03-08T15:42:43.684Z","memo":"Payment request for BitPay invoice 4Zrpank3aA2EAdYaQwMXbz for merchant Electronic Frontier Foundation","paymentUrl":"https://bitpay.com/i/4Zrpank3aA2EAdYaQwMXbz","paymentId":"4Zrpank3aA2EAdYaQwMXbz"}',
};

exports.payProJson = {
  'bch': {
    body: Buffer.from(body.bch),
    headers: {
      'x-identity': 'mh65MN7drqmwpCRZcEeBEE9ceQCQ95HtZc',
      signature: '3a1c2dae616038003ab66490c7173f95daf863933258cd0163d59a9f15d797b06715ce4c9ecf7688b4220d9c13079ec9e9b8399ca5e8b162e3216b8512f84e3d',
      digest: 'SHA-256=b820bd1e643a45ef73c25f9771b8ed703de068171f93c8fee4633606480a7a0a',
      'x-signature-type': 'ecc',
    }
  },
  'btc': {
    body:  Buffer.from(body.btc),
    headers: {
      'x-identity': '1EMqSoDzMdBuuvM2RUnup3FnDeo6wuHxEg',
      signature: '8eb262abc4333eef8286f1bebcebb364bb240113319e85c106f9499d813c94337af0104362798d77f57baf8f1fc04723a69c7eaa66e308fb2ac0386873fd1ef9',
      digest: 'SHA-256=6f49d6fe37d7a8049dcb804d05f4a0c0ad0c7e50f12cd17a792a76e975b62a06',
        'x-signature-type': 'ecc',
    },
  }
};
exports.payProJsonV2Body = bodyV2 = {
  bch: '{"time":"2019-10-10T14:39:55.593Z","expires":"2019-10-10T14:54:55.593Z","memo":"Payment request for BitPay invoice TctdC5R9dFTUHuhSpvqF5B for merchant BitPay Visa® Load (USD-USA)","paymentUrl":"https://bitpay.com/i/TctdC5R9dFTUHuhSpvqF5B","paymentId":"TctdC5R9dFTUHuhSpvqF5B","chain":"BCH","network":"main","currency":"BCH","instructions":[{"type":"transaction","requiredFeeRate":1,"outputs":[{"amount":430500,"address":"qz846nqdq5t6ykrz9zn3khlc7xwcel0xjvzexnr0j9"}]}]}',
  btc: '{"time":"2019-10-07T15:31:58.691Z","expires":"2019-10-07T15:46:58.691Z","memo":"Payment request for BitPay invoice TRrzNNTLyfgL6LxyHDF6Tz for merchant BitPay Visa® Load (USD-USA)","paymentUrl":"https://bitpay.com/i/TRrzNNTLyfgL6LxyHDF6Tz","paymentId":"TRrzNNTLyfgL6LxyHDF6Tz","chain":"BTC","network":"main","currency":"","instructions":[{"type":"transaction","requiredFeeRate":10.101,"outputs":[{"amount":13900,"address":"1N7yuoyQmso8zt2fv3MvtD3TDS2PVXiJGj"}]}]}',
  eth: '{"time":"2019-10-10T14:57:01.924Z","expires":"2019-10-10T15:12:01.924Z","memo":"Payment request for BitPay invoice GsbhMZeeUebqzEeDmNubEP for merchant BitPay Visa® Load (USD-USA)","paymentUrl":"https://bitpay.com/i/GsbhMZeeUebqzEeDmNubEP","paymentId":"GsbhMZeeUebqzEeDmNubEP","chain":"ETH","network":"main","currency":"ETH","instructions":[{"type":"transaction","value":5214000000000000,"to":"0x52dE8D3fEbd3a06d3c627f59D56e6892B80DCf12","data":"0xb6b4af050000000000000000000000000000000000000000000000000012861af9dbe00000000000000000000000000000000000000000000000000000000005a43875660000000000000000000000000000000000000000000000000000016db9644f77cadbc5e4ee0119e349b39e42a049f5526b4eca8c225709d3fd73550c87de3d2096c9e28e9f3b440d991720673f01a67d3f74a912339beb77ed696f65f35e5bc4000000000000000000000000000000000000000000000000000000000000001c84ebb3c8fdeb8c59e35b1248a1af05ba8a332d745cc38a3193b1792e414dbdae41b55cbb5dbddf27fc539dd13a3bf1c72671d744b8706fcfb3eb2fce968456b40000000000000000000000000000000000000000000000000000000000000000","gasPrice":24229999974}]}'
};

exports.payProJsonV2 = {
  'btc': {
    body:  Buffer.from(bodyV2.btc),
    headers: {
      'x-identity': '1GA2vgw5byxqTpAUHEyyh7ahXnHU1FDDAy',
      signature: '60f02d8433b2cbf76ce76898ec8d36b38004c3575321f99d7c34bc773f6f4b757f9de905dfeede9c76545fa0a38b209323c518da5ed7251d85786dd24bf8df3b',
      digest: 'SHA-256=76d0d885dbe09105911e048017dc6fb9ea9268de510520567171969433c10838',
      'x-signature-type': 'ecc'
    },
  },
  'bch': {
    body: Buffer.from(bodyV2.bch),
    headers: {
      'x-identity': '1DbY94wCcLRM1Y6RGFg457JyqBbsYxzfiN',
      signature: '75ca242c4fef58b52afa2787f3032fc881879d9d1f669bea71178ce75aa125091bbe1019310bd483360301204668a42179788e9720be9bf10da1befc9e7b3ad7',
      digest: 'SHA-256=8175f983e4a6693c8ba01c51e1a3b5f75c1a7f6a2a9222bc0a243882c975b8d8',
      'x-signature-type': 'ecc'
    }
  },
  'eth': {
    body: Buffer.from(bodyV2.bch),
    headers: {
      'x-identity': '1EMqSoDzMdBuuvM2RUnup3FnDeo6wuHxEg',
      signature: '1701100e5bda63e7d4c311ab3c58d6edd01b6aa7b8cb314f36303dda3ce6a53b7ddebb9f9afe05fc6dd250cad215f8010472e57c4b71cab95e122d9fadb39957',
      digest: 'SHA-256=1c1c47d338efaf7a45e693051b04e50eb0a86c1fec0e3882b1987c58bfe7d058',
      'x-signature-type': 'ecc'
    }
  }
};

module.exports = exports;
