
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



var pp1 = '{"network":"test","currency":"BCH","requiredFeeRate":1.398,"outputs":[{"amount":769200,"address":"qz78y0832kskq84rr4f9t22fequ5c0l4gu6wsehezr"}],"time":"2019-03-07T18:05:44.301Z","expires":"2019-03-07T18:20:44.301Z","memo":"Payment request for BitPay invoice 3oZcpotopVGcZ2stRw2dop for merchant GusPay","paymentUrl":"https://test.bitpay.com/i/3oZcpotopVGcZ2stRw2dop","paymentId":"3oZcpotopVGcZ2stRw2dop"}';

exports.payProJson = {
  'bch': {
    body: Buffer.from(pp1),
    headers: {
      'x-identity': 'mh65MN7drqmwpCRZcEeBEE9ceQCQ95HtZc',
      signature: '3a1c2dae616038003ab66490c7173f95daf863933258cd0163d59a9f15d797b06715ce4c9ecf7688b4220d9c13079ec9e9b8399ca5e8b162e3216b8512f84e3d',
      digest: 'SHA-256=b820bd1e643a45ef73c25f9771b8ed703de068171f93c8fee4633606480a7a0a',
      'x-signature-type': 'ecc',
    }
  },
};

exports.payProAckHex = Buffer.from('{"memo":"an ack memo"}');

module.exports = exports;
