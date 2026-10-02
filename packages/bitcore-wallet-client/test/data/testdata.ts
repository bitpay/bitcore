
export const history = [{
  txid: '0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04',
  vin: [{
    txid: 'c8e221141e8bb60977896561b77fa59d6dacfcc10db82bf6f5f923048b11c70d',
    vout: 0,
    n: 0,
    addr: '2N6Zutg26LEC4iYVxi7SHhopVLP1iZPU1rZ',
    valueSat: 485645,
    value: 0.00485645,
  }, {
    txid: '6e599eea3e2898b91087eb87e041c5d8dec5362447a8efba185ed593f6dc64c0',
    vout: 1,
    n: 1,
    addr: '2MyqmcWjmVxW8i39wdk1CVPdEqKyFSY9H1S',
    valueSat: 885590,
    value: 0.0088559,
  }],
  vout: [{
    value: '0.00045753',
    n: 0,
    scriptPubKey: {
      addresses: [
        '2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V'
      ]
    },
  }, {
    value: '0.01300000',
    n: 1,
    scriptPubKey: {
      addresses: [
        'mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE'
      ]
    }
  }],
  time: 1424471041,
  blocktime: 20,
  valueOut: 0.01345753,
  valueIn: 0.01371235,
  fees: 0.00025482
}, {
  txid: 'fad88682ccd2ff34cac6f7355fe9ecd8addd9ef167e3788455972010e0d9d0de',
  vin: [{
    txid: '0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04',
    vout: 0,
    n: 0,
    addr: '2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V',
    valueSat: 45753,
    value: 0.00045753,
  }],
  vout: [{
    value: '0.00011454',
    n: 0,
    scriptPubKey: {
      addresses: [
        '2N7GT7XaN637eBFMmeczton2aZz5rfRdZso'
      ]
    }
  }, {
    value: '0.00020000',
    n: 1,
    scriptPubKey: {
      addresses: [
        'mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE'
      ]
    }
  }],
  firstSeenTs: 1424472242,
  blocktime: 10,
  valueOut: 0.00031454,
  valueIn: 0.00045753,
  fees: 0.00014299
}];

const body = {
  bch: '{"network":"test","currency":"BCH","requiredFeeRate":1.398,"outputs":[{"amount":769200,"address":"qz78y0832kskq84rr4f9t22fequ5c0l4gu6wsehezr"}],"time":"2019-03-07T18:05:44.301Z","expires":"2019-03-07T18:20:44.301Z","memo":"Payment request for BitPay invoice 3oZcpotopVGcZ2stRw2dop for merchant GusPay","paymentUrl":"https://test.bitpay.com/i/3oZcpotopVGcZ2stRw2dop","paymentId":"3oZcpotopVGcZ2stRw2dop"}',
  btc: '{"network":"main","currency":"BTC","requiredFeeRate":27.001,"outputs":[{"amount":1004800,"address":"1MR4ucgpxum2iPYCixX77Qi9rR4im3ccsx"}],"time":"2019-03-08T15:27:43.684Z","expires":"2019-03-08T15:42:43.684Z","memo":"Payment request for BitPay invoice 4Zrpank3aA2EAdYaQwMXbz for merchant Electronic Frontier Foundation","paymentUrl":"https://bitpay.com/i/4Zrpank3aA2EAdYaQwMXbz","paymentId":"4Zrpank3aA2EAdYaQwMXbz"}',
};

export const payProJsonBody = body;

export const payProJson = {
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
    body: Buffer.from(body.btc),
    headers: {
      'x-identity': '1EMqSoDzMdBuuvM2RUnup3FnDeo6wuHxEg',
      signature: '8eb262abc4333eef8286f1bebcebb364bb240113319e85c106f9499d813c94337af0104362798d77f57baf8f1fc04723a69c7eaa66e308fb2ac0386873fd1ef9',
      digest: 'SHA-256=6f49d6fe37d7a8049dcb804d05f4a0c0ad0c7e50f12cd17a792a76e975b62a06',
      'x-signature-type': 'ecc',
    },
  }
};

const bodyV2 = {
  bch: '{"time":"2019-11-05T17:05:31.791Z","expires":"2019-11-05T17:20:31.791Z","memo":"Payment request for BitPay invoice XM8XbreRs6cnKkR3yYT6qQ for merchant BitPay Visa® Load (USD-USA)","paymentUrl":"https://bitpay.com/i/XM8XbreRs6cnKkR3yYT6qQ","paymentId":"XM8XbreRs6cnKkR3yYT6qQ","chain":"BCH","network":"main","instructions":[{"type":"transaction","requiredFeeRate":1,"outputs":[{"amount":337900,"address":"qpymzlw4dfgawe2hy6xalj0qnzwedrqfvg96jl5ev6"}]}]}',
  btc: '{"time":"2019-11-05T15:21:09.047Z","expires":"2019-11-05T15:36:09.047Z","memo":"Payment request for BitPay invoice LanynqCPoL2JQb8z8s5Z3X for merchant BitPay Visa® Load (USD-USA)","paymentUrl":"https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X","paymentId":"LanynqCPoL2JQb8z8s5Z3X","chain":"BTC","network":"main","instructions":[{"type":"transaction","requiredFeeRate":34.337,"outputs":[{"amount":19800,"address":"1CpEMwff6DA52FLoq4JAhd2xFSEjQxyokm"}]}]}',
  eth: '{"time":"2019-10-10T14:57:01.924Z","expires":"2019-10-10T15:12:01.924Z","memo":"Payment request for BitPay invoice GsbhMZeeUebqzEeDmNubEP for merchant BitPay Visa® Load (USD-USA)","paymentUrl":"https://bitpay.com/i/GsbhMZeeUebqzEeDmNubEP","paymentId":"GsbhMZeeUebqzEeDmNubEP","chain":"ETH","network":"main","currency":"ETH","instructions":[{"type":"transaction","amount":5214000000000000,"toAddress":"0x52dE8D3fEbd3a06d3c627f59D56e6892B80DCf12","value":5214000000000000,"to":"0x52dE8D3fEbd3a06d3c627f59D56e6892B80DCf12","data":"0xb6b4af050000000000000000000000000000000000000000000000000012861af9dbe00000000000000000000000000000000000000000000000000000000005a43875660000000000000000000000000000000000000000000000000000016db9644f77cadbc5e4ee0119e349b39e42a049f5526b4eca8c225709d3fd73550c87de3d2096c9e28e9f3b440d991720673f01a67d3f74a912339beb77ed696f65f35e5bc4000000000000000000000000000000000000000000000000000000000000001c84ebb3c8fdeb8c59e35b1248a1af05ba8a332d745cc38a3193b1792e414dbdae41b55cbb5dbddf27fc539dd13a3bf1c72671d744b8706fcfb3eb2fce968456b40000000000000000000000000000000000000000000000000000000000000000","gasPrice":24229999974}]}',
  // Two ordered EVM instructions - an ERC-20 `approve` followed by BitPay's
  // `pay` contract call - both with a zero visible amount, matching real
  // token PayPro requests where the actual payment amount lives in calldata.
  // `0xA0b8...eB48` is mainnet USDC's real contract address
  // (crypto-wallet-core's token registry); `approve`/`pay` calldata is
  // ABI-encoded with `ethers.Interface` against `approve(address,uint256)`
  // and BWS's real `Invoice.pay(...)` signature
  // (chain/eth/abi-invoice.ts), not hand-written hex, so the selectors
  // (`0x095ea7b3`, `0xb6b4af05`) and argument layout are genuine.
  // `0x1BA1...f7C1` (the `pay` target) is an arbitrary but validly
  // EIP-55-checksummed placeholder for BitPay's invoice contract, not a
  // real deployed address.
  erc20: '{"time":"2026-08-01T00:00:00.000Z","expires":"2026-08-01T00:15:00.000Z","memo":"Payment request for BitPay invoice UsdcErc20Fixture1 for merchant Test Merchant","paymentUrl":"https://bitpay.com/i/UsdcErc20Fixture1","paymentId":"UsdcErc20Fixture1","chain":"ETH","network":"main","currency":"USDC","instructions":[{"type":"transaction","amount":0,"toAddress":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","value":0,"to":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","data":"0x095ea7b30000000000000000000000001ba1e35a29e2a52a1b1a1e2c8dbb28b9b5b6f7c10000000000000000000000000000000000000000000000000000000000989680"},{"type":"transaction","amount":0,"toAddress":"0x1BA1E35A29E2A52a1b1A1e2c8dbB28B9B5B6f7C1","value":0,"to":"0x1BA1E35A29E2A52a1b1A1e2c8dbB28B9B5B6f7C1","data":"0xb6b4af05000000000000000000000000000000000000000000000000000000000098968000000000000000000000000000000000000000000000000000000009502f9000000000000000000000000000000000000000000000000000000001b8dac5b40000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001b00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000004000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"}]}',
  xrp: '{"time":"2026-08-01T00:00:00.000Z","expires":"2026-08-01T00:15:00.000Z","memo":"Payment request for BitPay invoice XrpFixture1 for merchant Test Merchant","paymentUrl":"https://bitpay.com/i/XrpFixture1","paymentId":"XrpFixture1","chain":"XRP","network":"main","currency":"XRP","instructions":[{"type":"transaction","requiredFeeRate":12,"outputs":[{"address":"rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh","amount":10000,"destinationTag":12345,"invoiceID":"0000000000000000000000000000000000000000000000000000000000000001"}]}]}',
  sol: '{"time":"2026-08-01T00:00:00.000Z","expires":"2026-08-01T00:15:00.000Z","memo":"Payment request for BitPay invoice SolFixture1 for merchant Test Merchant","paymentUrl":"https://bitpay.com/i/SolFixture1","paymentId":"SolFixture1","chain":"SOL","network":"main","currency":"SOL","instructions":[{"type":"transaction","outputs":[{"address":"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d","amount":10000,"invoiceID":"SolInvoiceFixture1"}]}]}'
};
export const payProJsonV2Body = bodyV2;

// Identity/pubkey for the fixtures below that are signed with a test-only
// keypair rather than a real BitPay production key. `PayProV2.trustedKeys`
// only trusts a fixed set of production keys, so any test that verifies one
// of these fixtures through the real `PayProV2.verifyResponse` path must
// first merge this entry into `PayProV2.trustedKeys` (see the existing
// `domains` stub pattern in api.test.ts's "Payment Protocol V2" suite).
// Private key (test-only, never used for anything real):
// 4e7f2a6c1d9b8e3f05a1c7d4b6e9f2038a4c6d8e0f123456789abcdef0123ab
export const payProJsonV2TestKey = {
  identity: '1CxjbDcNzxEGxRBiiCmPm2HZneedE4FQz8',
  keyData: {
    owner: 'IS-1413 test fixture key (NOT a real BitPay key)',
    networks: ['main'],
    domains: ['bitpay.com'],
    publicKey: '0227a3a3ef276d0e8fd39b1b9bb02123103be427ef1edf10815059dace6e98b1c7'
  }
};


export const payProJsonV2 = {
  'btc': {
    body: Buffer.from(bodyV2.btc),
    headers: {
      'x-identity': '1DbY94wCcLRM1Y6RGFg457JyqBbsYxzfiN',
      signature: '61e74de80655486d11490baa2da96bac8d2f7332b349e7de869f451fe80fb8892ecb69d48bc8d19ee96396bf0c7aeeaffcd84538cd96e600567499ab99f1d7ac',
      digest: 'SHA-256=11d2c9d7f4ff8a843f567c3ce0982201252c78f7d29501fadfffed68aa49c6c9',
      'x-signature-type': 'ecc'
    },
  },
  'bch': {
    body: Buffer.from(bodyV2.bch),
    headers: {
      'x-identity': '1DbY94wCcLRM1Y6RGFg457JyqBbsYxzfiN',
      signature: '754b7fa51be429fe89faf5b72605a39846a433aa44464f178503b2d499d0b6951ae3ffa313c7b175f019aa0f4f94c73be03818840b27743ad88bef56c63171aa',
      digest: 'SHA-256=512b6acba3fe082ff6486c7d4934fabee3e34d6466501c97351987326f107547',
      'x-signature-type': 'ecc'
    }
  },
  // Signed with `payProJsonV2TestKey`, not a real BitPay production key -
  // BitPay's real private keys aren't available to this test suite. Any
  // caller must register `payProJsonV2TestKey` into `PayProV2.trustedKeys`
  // first, or verification fails with "signed by unknown key"
  'eth': {
    body: Buffer.from(bodyV2.eth),
    headers: {
      'x-identity': payProJsonV2TestKey.identity,
      signature: '683801508575cc7077897814f8ffcfc07038a78a42bf19c6491013287865acb10ad25c71e8e3310296085a2865ba8ddc38c9f1904fd345bcdb452f6182add40e',
      digest: 'SHA-256=337b16645745e48f0eeef01e596abbc52c7a833c0bafb661979838bc3b3f4ef1',
      'x-signature-type': 'ecc'
    }
  },
  // Two ordered EVM instructions (ERC-20 `approve` + BitPay `pay`), both with
  // a zero visible amount. Signed with `payProJsonV2TestKey`.
  'erc20': {
    body: Buffer.from(bodyV2.erc20),
    headers: {
      'x-identity': payProJsonV2TestKey.identity,
      signature: '02df4ad64811ef08486bbc223e2d3bf8d173d25bf5b3ff6de46c5b97bffd70c1281ca277daf47c6e66c150c50305b6d2d1ec72774bd1bfca41d2e3ebea947b70',
      digest: 'SHA-256=b69afce8f0665d60187263bf74d34e2742d0a590c97abdb1fda6919a0ccc0a7d',
      'x-signature-type': 'ecc'
    }
  },
  // XRP instruction carrying a destination tag and invoice ID. Signed with
  // `payProJsonV2TestKey`.
  'xrp': {
    body: Buffer.from(bodyV2.xrp),
    headers: {
      'x-identity': payProJsonV2TestKey.identity,
      signature: '7cdf731d005fe1cecd3989b1a203a3c77240468f583977290d22f163ebb2b94f0d15bcdbd1cacd36e3493ade08e25adc3e098a05bf4159395588cc015f0d31c2',
      digest: 'SHA-256=0f092ea4ba9f5b5f27051ba9370977518a780fa542e4e18086ae54bb4a60355a',
      'x-signature-type': 'ecc'
    }
  },
  // SOL instruction carrying an invoice memo/ID. Signed with `payProJsonV2TestKey`.
  'sol': {
    body: Buffer.from(bodyV2.sol),
    headers: {
      'x-identity': payProJsonV2TestKey.identity,
      signature: '7677376aedabe1a1108eb06547b700d217d5215f092f710d277363d59217c7a40f2076bb1c8649652f74249fa609985421a2229bc72e22ac5ea6ea1fb2adbbda',
      digest: 'SHA-256=9439d49538617c2dd5c179e6eecdf793ccd8ca046cc3055d2cb804de605d88f3',
      'x-signature-type': 'ecc'
    }
  }
};