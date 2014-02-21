'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');
var should = chai.should();

var Address = bitcore.Address.class();
var PrivateKey = bitcore.PrivateKey.class();
var networks = bitcore.networks;
var KeyModule = bitcore.KeyModule;


function test_encode_priv(b58, payload, isTestnet, isCompressed) {
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = network.keySecret;

  var buf_pl = new Buffer(payload, 'hex');
  var buf;
  if (isCompressed) {
    buf = new Buffer(buf_pl.length + 1);
    buf_pl.copy(buf);
    buf[buf_pl.length] = 1;
  } else
    buf = buf_pl;

  var key = new KeyModule.Key();
  key.private = buf;
  key.compressed = isCompressed;

  var privkey = new PrivateKey(version, buf);
  privkey.toString().should.equal(b58);
}

function test_encode_pub(b58, payload, isTestnet, addrType) {
  var isScript = (addrType === 'script');
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = isScript ? network.addressScript : network.addressPubkey;
  var buf = new Buffer(payload, 'hex');
  var addr = new Address(version, buf);
  addr.toString().should.equal(b58);

}

function test_decode_priv(b58, payload, isTestnet, isCompressed) {
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = network.keySecret;

  var buf_pl = new Buffer(payload, 'hex');
  var buf;
  if (isCompressed) {
    buf = new Buffer(buf_pl.length + 1);
    buf_pl.copy(buf);
    buf[buf_pl.length] = 1;
  } else
    buf = buf_pl;

  var privkey = new PrivateKey(b58);
  version.should.equal(privkey.version());
  buf_pl.toString().should.equal(privkey.payload().toString());
}

function test_decode_pub(b58, payload, isTestnet, addrType) {
  var isScript = (addrType === 'script');
  var network = isTestnet ? networks.testnet : networks.livenet;
  var version = isScript ? network.addressScript : network.addressPubkey;
  var buf = new Buffer(payload, 'hex');
  var addr = new Address(b58);

  version.should.equal(addr.version());
  buf.toString().should.equal(addr.payload().toString());
}

function is_valid(datum) {
  var b58 = datum[0];
  var payload = datum[1];
  var obj = datum[2];
  var isPrivkey = obj.isPrivkey;
  var isTestnet = obj.isTestnet;

  if (isPrivkey) {
    var isCompressed = obj.isCompressed;
    test_encode_priv(b58, payload, isTestnet, isCompressed);
    test_decode_priv(b58, payload, isTestnet, isCompressed);
  } else {
    var addrType = obj.addrType;
    test_encode_pub(b58, payload, isTestnet, addrType);
    test_decode_pub(b58, payload, isTestnet, addrType);
  }
}

function is_invalid(datum) {
  if (datum.length < 1)
    throw new Error('Bad test');

  // ignore succeeding elements, as comments
  var b58 = datum[0];
  var privkey = new PrivateKey(b58);
  var addr = new Address(b58);

  var valid = true;
  try {
    privkey.validate();
    addr.validate();
  } catch (e) {
    valid = false;
  }
  valid.should.equal(false);
}

var dataValid = [
  [
    '1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i',
    '65a16059864a2fdbc7c99a4723a8395bc6f188eb', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '3CMNFxN1oHBc4R1EpboAL5yzHGgE611Xou',
    '74f209f6ea907e2ea48f74fae05782ae8a665257', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    'mo9ncXisMeAoXwqcV5EWuyncbmCcQN4rVs',
    '53c0307d6851aa0ce7825ba883c6bd9ad242b486', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br',
    '6349a418fc4578d10a372b54b45c280cc8c4382f', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe6E3AgLr',
    'eddbdc1168f1daeadbd3e44c1e3f8f5a284c2029f78ad26af98583a499de5b19', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    'Kz6UJmQACJmLtaQj5A3JAge4kVTNQ8gbvXuwbmCj7bsaabudb3RD',
    '55c9bccb9ed68446d1b75273bbce89d7fe013a8acd1625514420fb2aca1a21c4', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    '9213qJab2HNEpMpYNBa7wHGFKKbkDn24jpANDs2huN3yi4J11ko',
    '36cb93b9ab1bdabf7fb9f2c04f1b9cc879933530ae7842398eef5a63a56800c2', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    'cTpB4YiyKiBcPxnefsDpbnDxFDffjqJob8wGCEDXxgQ7zQoMXJdH',
    'b9f4892c9e8282028fea1d2667c4dc5213564d41fc5783896a0d843fc15089f3', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    '1Ax4gZtb7gAit2TivwejZHYtNNLT18PUXJ',
    '6d23156cbbdcc82a5a47eee4c2c7c583c18b6bf4', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '3QjYXhTkvuj8qPaXHTTWb5wjXhdsLAAWVy',
    'fcc5460dd6e2487c7d75b1963625da0e8f4c5975', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    'n3ZddxzLvAY9o7184TB4c6FJasAybsw4HZ',
    'f1d470f9b02370fdec2e6b708b08ac431bf7a5f7', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '2NBFNJTktNa7GZusGbDbGKRZTxdK9VVez3n',
    'c579342c2c4c9220205e2cdc285617040c924a0a', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '5K494XZwps2bGyeL71pWid4noiSNA2cfCibrvRWqcHSptoFn7rc',
    'a326b95ebae30164217d7a7f57d72ab2b54e3be64928a19da0210b9568d4015e', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    'L1RrrnXkcKut5DEMwtDthjwRcTTwED36thyL1DebVrKuwvohjMNi',
    '7d998b45c219a1e38e99e7cbd312ef67f77a455a9b50c730c27f02c6f730dfb4', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    '93DVKyFYwSN6wEo3E2fCrFPUp17FtrtNi2Lf7n4G3garFb16CRj',
    'd6bca256b5abc5602ec2e1c121a08b0da2556587430bcf7e1898af2224885203', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    'cTDVKtMGVYWTHCb1AFjmVbEbWjvKpKqKgMaR3QJxToMSQAhmCeTN',
    'a81ca4e8f90181ec4b61b6a7eb998af17b2cb04de8a03b504b9e34c4c61db7d9', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    '1C5bSj1iEGUgSTbziymG7Cn18ENQuT36vv',
    '7987ccaa53d02c8873487ef919677cd3db7a6912', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '3AnNxabYGoTxYiTEZwFEnerUoeFXK2Zoks',
    '63bcc565f9e68ee0189dd5cc67f1b0e5f02f45cb', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    'n3LnJXCqbPjghuVs8ph9CYsAe4Sh4j97wk',
    'ef66444b5b17f14e8fae6e7e19b045a78c54fd79', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '2NB72XtkjpnATMggui83aEtPawyyKvnbX2o',
    'c3e55fceceaa4391ed2a9677f4a4d34eacd021a0', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '5KaBW9vNtWNhc3ZEDyNCiXLPdVPHCikRxSBWwV9NrpLLa4LsXi9',
    'e75d936d56377f432f404aabb406601f892fd49da90eb6ac558a733c93b47252', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    'L1axzbSyynNYA8mCAhzxkipKkfHtAXYF4YQnhSKcLV8YXA874fgT',
    '8248bd0375f2f75d7e274ae544fb920f51784480866b102384190b1addfbaa5c', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    '927CnUkUbasYtDwYwVn2j8GdTuACNnKkjZ1rpZd2yBB1CLcnXpo',
    '44c4f6a096eac5238291a94cc24c01e3b19b8d8cef72874a079e00a242237a52', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    'cUcfCMRjiQf85YMzzQEk9d1s5A4K7xL5SmBCLrezqXFuTVefyhY7',
    'd1de707020a9059d6d3abaf85e17967c6555151143db13dbb06db78df0f15c69', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    '1Gqk4Tv79P91Cc1STQtU3s1W6277M2CVWu',
    'adc1cc2081a27206fae25792f28bbc55b831549d', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '33vt8ViH5jsr115AGkW6cEmEz9MpvJSwDk',
    '188f91a931947eddd7432d6e614387e32b244709', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    'mhaMcBxNh5cqXm4aTQ6EcVbKtfL6LGyK2H',
    '1694f5bc1a7295b600f40018a618a6ea48eeb498', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '2MxgPqX1iThW3oZVk9KoFcE5M4JpiETssVN',
    '3b9b3fd7a50d4f08d1a5b0f62f644fa7115ae2f3', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '5HtH6GdcwCJA4ggWEL1B3jzBBUB8HPiBi9SBc5h9i4Wk4PSeApR',
    '091035445ef105fa1bb125eccfb1882f3fe69592265956ade751fd095033d8d0', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    'L2xSYmMeVo3Zek3ZTsv9xUrXVAmrWxJ8Ua4cw8pkfbQhcEFhkXT8',
    'ab2b4bcdfc91d34dee0ae2a8c6b6668dadaeb3a88b9859743156f462325187af', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    '92xFEve1Z9N8Z641KQQS7ByCSb8kGjsDzw6fAmjHN1LZGKQXyMq',
    'b4204389cef18bbe2b353623cbf93e8678fbc92a475b664ae98ed594e6cf0856', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    'cVM65tdYu1YK37tNoAyGoJTR13VBYFva1vg9FLuPAsJijGvG6NEA',
    'e7b230133f1b5489843260236b06edca25f66adb1be455fbd38d4010d48faeef', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    '1JwMWBVLtiqtscbaRHai4pqHokhFCbtoB4',
    'c4c1b72491ede1eedaca00618407ee0b772cad0d', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '3QCzvfL4ZRvmJFiWWBVwxfdaNBT8EtxB5y',
    'f6fe69bcb548a829cce4c57bf6fff8af3a5981f9', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    'mizXiucXRCsEriQCHUkCqef9ph9qtPbZZ6',
    '261f83568a098a8638844bd7aeca039d5f2352c0', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '2NEWDzHWwY5ZZp8CQWbB7ouNMLqCia6YRda',
    'e930e1834a4d234702773951d627cce82fbb5d2e', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '5KQmDryMNDcisTzRp3zEq9e4awRmJrEVU1j5vFRTKpRNYPqYrMg',
    'd1fab7ab7385ad26872237f1eb9789aa25cc986bacc695e07ac571d6cdac8bc0', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    'L39Fy7AC2Hhj95gh3Yb2AU5YHh1mQSAHgpNixvm27poizcJyLtUi',
    'b0bbede33ef254e8376aceb1510253fc3550efd0fcf84dcd0c9998b288f166b3', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    '91cTVUcgydqyZLgaANpf1fvL55FH53QMm4BsnCADVNYuWuqdVys',
    '037f4192c630f399d9271e26c575269b1d15be553ea1a7217f0cb8513cef41cb', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    'cQspfSzsgLeiJGB2u8vrAiWpCU4MxUT6JseWo2SjXy4Qbzn2fwDw',
    '6251e205e8ad508bab5596bee086ef16cd4b239e0cc0c5d7c4e6035441e7d5de', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    '19dcawoKcZdQz365WpXWMhX6QCUpR9SY4r',
    '5eadaf9bb7121f0f192561a5a62f5e5f54210292', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '37Sp6Rv3y4kVd1nQ1JV5pfqXccHNyZm1x3',
    '3f210e7277c899c3a155cc1c90f4106cbddeec6e', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    'myoqcgYiehufrsnnkqdqbp69dddVDMopJu',
    'c8a3c2a09a298592c3e180f02487cd91ba3400b5', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '2N7FuwuUuoTBrDFdrAZ9KxBmtqMLxce9i1C',
    '99b31df7c9068d1481b596578ddbb4d3bd90baeb', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': true
    }
  ],
  [
    '5KL6zEaMtPRXZKo1bbMq7JDjjo1bJuQcsgL33je3oY8uSJCR5b4',
    'c7666842503db6dc6ea061f092cfb9c388448629a6fe868d068c42a488b478ae', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    'KwV9KAfwbwt51veZWNscRTeZs9CKpojyu1MsPnaKTF5kz69H1UN2',
    '07f0803fc5399e773555ab1e8939907e9badacc17ca129e67a2f5f2ff84351dd', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': false
    }
  ],
  [
    '93N87D6uxSBzwXvpokpzg8FFmfQPmvX4xHoWQe3pLdYpbiwT5YV',
    'ea577acfb5d1d14d3b7b195c321566f12f87d2b77ea3a53f68df7ebf8604a801', {
      'isCompressed': false,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    'cMxXusSihaX58wpJ3tNuuUcZEQGt6DKJ1wEpxys88FFaQCYjku9h',
    '0b3b34f0958d8a268193a9814da92c3e8b58b4a4378a542863e34ac289cd830c', {
      'isCompressed': true,
      'isPrivkey': true,
      'isTestnet': true
    }
  ],
  [
    '13p1ijLwsnrcuyqcTvJXkq2ASdXqcnEBLE',
    '1ed467017f043e91ed4c44b4e8dd674db211c4e6', {
      'addrType': 'pubkey',
      'isPrivkey': false,
      'isTestnet': false
    }
  ],
  [
    '3ALJH9Y951VCGcVZYAdpA3KchoP9McEj1G',
    '5ece0cadddc415b1980f001785947120acdb36fc', {
      'addrType': 'script',
      'isPrivkey': false,
      'isTestnet': false
    }
  ]
];

var dataInvalid = [
  [
    ''
  ],
  [
    'x'
  ],
  [
    '37qgekLpCCHrQuSjvX3fs496FWTGsHFHizjJAs6NPcR47aefnnCWECAhHV6E3g4YN7u7Yuwod5Y'
  ],
  [
    'dzb7VV1Ui55BARxv7ATxAtCUeJsANKovDGWFVgpTbhq9gvPqP3yv'
  ],
  [
    'MuNu7ZAEDFiHthiunm7dPjwKqrVNCM3mAz6rP9zFveQu14YA8CxExSJTHcVP9DErn6u84E6Ej7S'
  ],
  [
    'rPpQpYknyNQ5AEHuY6H8ijJJrYc2nDKKk9jjmKEXsWzyAQcFGpDLU2Zvsmoi8JLR7hAwoy3RQWf'
  ],
  [
    '4Uc3FmN6NQ6zLBK5QQBXRBUREaaHwCZYsGCueHauuDmJpZKn6jkEskMB2Zi2CNgtb5r6epWEFfUJq'
  ],
  [
    '7aQgR5DFQ25vyXmqZAWmnVCjL3PkBcdVkBUpjrjMTcghHx3E8wb'
  ],
  [
    '17QpPprjeg69fW1DV8DcYYCKvWjYhXvWkov6MJ1iTTvMFj6weAqW7wybZeH57WTNxXVCRH4veVs'
  ],
  [
    'KxuACDviz8Xvpn1xAh9MfopySZNuyajYMZWz16Dv2mHHryznWUp3'
  ],
  [
    '7nK3GSmqdXJQtdohvGfJ7KsSmn3TmGqExug49583bDAL91pVSGq5xS9SHoAYL3Wv3ijKTit65th'
  ],
  [
    'cTivdBmq7bay3RFGEBBuNfMh2P1pDCgRYN2Wbxmgwr4ki3jNUL2va'
  ],
  [
    'gjMV4vjNjyMrna4fsAr8bWxAbwtmMUBXJS3zL4NJt5qjozpbQLmAfK1uA3CquSqsZQMpoD1g2nk'
  ],
  [
    'emXm1naBMoVzPjbk7xpeTVMFy4oDEe25UmoyGgKEB1gGWsK8kRGs'
  ],
  [
    '7VThQnNRj1o3Zyvc7XHPRrjDf8j2oivPTeDXnRPYWeYGE4pXeRJDZgf28ppti5hsHWXS2GSobdqyo'
  ],
  [
    '1G9u6oCVCPh2o8m3t55ACiYvG1y5BHewUkDSdiQarDcYXXhFHYdzMdYfUAhfxn5vNZBwpgUNpso'
  ],
  [
    '31QQ7ZMLkScDiB4VyZjuptr7AEc9j1SjstF7pRoLhHTGkW4Q2y9XELobQmhhWxeRvqcukGd1XCq'
  ],
  [
    'DHqKSnpxa8ZdQyH8keAhvLTrfkyBMQxqngcQA5N8LQ9KVt25kmGN'
  ],
  [
    '2LUHcJPbwLCy9GLH1qXmfmAwvadWw4bp4PCpDfduLqV17s6iDcy1imUwhQJhAoNoN1XNmweiJP4i'
  ],
  [
    '7USRzBXAnmck8fX9HmW7RAb4qt92VFX6soCnts9s74wxm4gguVhtG5of8fZGbNPJA83irHVY6bCos'
  ],
  [
    '1DGezo7BfVebZxAbNT3XGujdeHyNNBF3vnficYoTSp4PfK2QaML9bHzAMxke3wdKdHYWmsMTJVu'
  ],
  [
    '2D12DqDZKwCxxkzs1ZATJWvgJGhQ4cFi3WrizQ5zLAyhN5HxuAJ1yMYaJp8GuYsTLLxTAz6otCfb'
  ],
  [
    '8AFJzuTujXjw1Z6M3fWhQ1ujDW7zsV4ePeVjVo7D1egERqSW9nZ'
  ],
  [
    '163Q17qLbTCue8YY3AvjpUhotuaodLm2uqMhpYirsKjVqnxJRWTEoywMVY3NbBAHuhAJ2cF9GAZ'
  ],
  [
    '2MnmgiRH4eGLyLc9eAqStzk7dFgBjFtUCtu'
  ],
  [
    '461QQ2sYWxU7H2PV4oBwJGNch8XVTYYbZxU'
  ],
  [
    '2UCtv53VttmQYkVU4VMtXB31REvQg4ABzs41AEKZ8UcB7DAfVzdkV9JDErwGwyj5AUHLkmgZeobs'
  ],
  [
    'cSNjAsnhgtiFMi6MtfvgscMB2Cbhn2v1FUYfviJ1CdjfidvmeW6mn'
  ],
  [
    'gmsow2Y6EWAFDFE1CE4Hd3Tpu2BvfmBfG1SXsuRARbnt1WjkZnFh1qGTiptWWbjsq2Q6qvpgJVj'
  ],
  [
    'nksUKSkzS76v8EsSgozXGMoQFiCoCHzCVajFKAXqzK5on9ZJYVHMD5CKwgmX3S3c7M1U3xabUny'
  ],
  [
    'L3favK1UzFGgdzYBF2oBT5tbayCo4vtVBLJhg2iYuMeePxWG8SQc'
  ],
  [
    '7VxLxGGtYT6N99GdEfi6xz56xdQ8nP2dG1CavuXx7Rf2PrvNMTBNevjkfgs9JmkcGm6EXpj8ipyPZ'
  ],
  [
    '2mbZwFXF6cxShaCo2czTRB62WTx9LxhTtpP'
  ],
  [
    'dB7cwYdcPSgiyAwKWL3JwCVwSk6epU2txw'
  ],
  [
    'HPhFUhUAh8ZQQisH8QQWafAxtQYju3SFTX'
  ],
  [
    '4ctAH6AkHzq5ioiM1m9T3E2hiYEev5mTsB'
  ],
  [
    'Hn1uFi4dNexWrqARpjMqgT6cX1UsNPuV3cHdGg9ExyXw8HTKadbktRDtdeVmY3M1BxJStiL4vjJ'
  ],
  [
    'Sq3fDbvutABmnAHHExJDgPLQn44KnNC7UsXuT7KZecpaYDMU9Txs'
  ],
  [
    '6TqWyrqdgUEYDQU1aChMuFMMEimHX44qHFzCUgGfqxGgZNMUVWJ'
  ],
  [
    'giqJo7oWqFxNKWyrgcBxAVHXnjJ1t6cGoEffce5Y1y7u649Noj5wJ4mmiUAKEVVrYAGg2KPB3Y4'
  ],
  [
    'cNzHY5e8vcmM3QVJUcjCyiKMYfeYvyueq5qCMV3kqcySoLyGLYUK'
  ],
  [
    '37uTe568EYc9WLoHEd9jXEvUiWbq5LFLscNyqvAzLU5vBArUJA6eydkLmnMwJDjkL5kXc2VK7ig'
  ],
  [
    'EsYbG4tWWWY45G31nox838qNdzksbPySWc'
  ],
  [
    'nbuzhfwMoNzA3PaFnyLcRxE9bTJPDkjZ6Rf6Y6o2ckXZfzZzXBT'
  ],
  [
    'cQN9PoxZeCWK1x56xnz6QYAsvR11XAce3Ehp3gMUdfSQ53Y2mPzx'
  ],
  [
    '1Gm3N3rkef6iMbx4voBzaxtXcmmiMTqZPhcuAepRzYUJQW4qRpEnHvMojzof42hjFRf8PE2jPde'
  ],
  [
    '2TAq2tuN6x6m233bpT7yqdYQPELdTDJn1eU'
  ],
  [
    'ntEtnnGhqPii4joABvBtSEJG6BxjT2tUZqE8PcVYgk3RHpgxgHDCQxNbLJf7ardf1dDk2oCQ7Cf'
  ],
  [
    'Ky1YjoZNgQ196HJV3HpdkecfhRBmRZdMJk89Hi5KGfpfPwS2bUbfd'
  ],
  [
    '2A1q1YsMZowabbvta7kTy2Fd6qN4r5ZCeG3qLpvZBMzCixMUdkN2Y4dHB1wPsZAeVXUGD83MfRED'
  ]
];
var dataValues = [
  ['0', '0'],
  ['1.0', '100000000'],
  ['0.1', '10000000'],
  ['.1', '10000000'],
  ['0.0005', '50000']
];

describe('Valid base58 keys', function() {
  dataValid.forEach(function(datum) {
    it('valid ' + datum[0], function() {
      is_valid(datum);
    });
  });
});

describe('Invalid base58 keys', function() {
  dataInvalid.forEach(function(datum) {
    it('invalid ' + datum, function() {
      is_invalid(datum);
    });
  });
});
