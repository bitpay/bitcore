var keyPair = {
  priv: '0dea92f1df6675085b5cdd965487bb862f84f2755bcb56fa45dbf5b387a6c4a0',
  pub: '026092daeed8ecb2212869395770e956ffc9bf453f803e700f64ffa70c97a00d80',
};

var message = {
  text: 'hello world',
  signature: '304402204c5c754f35ac3f4766f246a71f956dee8233964a51991c261f2611c79e906641022070cb6ed2b1c3afae8110f110f332bebf30b3154ff8cf56fb1fe8db5cc09ce07d', // with e57d978f1d4a43df38a451ca2adf70c0416c202a89badf068e0d6de2023879cc (m/1/1 of copayer's xpriv) 
};

var copayers = [{
  id: '03bc5f0504c8dd480926dbe90449ccc7b2fc4c96e79f1cb8ffcd31731e2ee8db9b',
  xPrivKey: 'xprv9s21ZrQH143K2rMHbXTJmWTuFx6ssqn1vyRoZqPkCXYchBSkp5ey8kMJe84sxfXq5uChWH4gk94rWbXZt2opN9kg4ufKGvUM7HQSLjnoh7e',
  xPubKey: 'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9',
  xPubKeySignature: '30440220192ae7345d980f45f908bd63ccad60ce04270d07b91f1a9d92424a07a38af85202201591f0f71dd4e79d9206d2306862e6b8375e13a62c193953d768e884b6fb5a46', // signed using keyPair.priv
  privKey: 'e57d978f1d4a43df38a451ca2adf70c0416c202a89badf068e0d6de2023879cc', // derived with 'm/1/1'
}, {
  id: '0235223413f8219260aa892c518969701af7c339284afecc7044f98dd47d48754b',
  xPrivKey: 'xprv9s21ZrQH143K2JgXh8Va3Taq22D2gXw2nYULffV5dc9acQvAmB3KhomPKGwV9AbVsBcAXMW2QxCnvmHU1rVtHRfZwTxdEEAN5ZojRYdryQ1',
  xPubKey: 'xpub661MyMwAqRbcEnkzoA2aQbXZa43X5zet9mPwU3thBwgZVDFKJiMaFc5sAYS97qVtMxpvceittobtoH2JKmpweSN1CLSe91hiE1Wrf5YJhsQ',
  xPubKeySignature: '3045022100b9079d0d9b70da828b0e9c776fe01c5c13fc254a314c0b09a638c8695ec9360c022079922950779080569163c692ed8ee882f9ef37e7b2dff03de9c6756e7599960e',
}, {
  id: '023f31628856799ce6a12d02d362fbf6acc2c112207eeeb7bd34a048ec2127645d',
  xPrivKey: 'xprv9s21ZrQH143K2DoxHNrecLmp121HU4nZRB57jj2cGmSkp9Wrgz2AevFT98AcYocYXEyyWDwC1JUn13beDjQU87FwfCaHiWhgoSx9G31tmDa',
  xPubKey: 'xpub661MyMwAqRbcEhtRPQPeyUiYZ3qmsXWQnPziY7SDq6yjgwr1EXLRCiZvzQsfnQehH8hBzCxNPYCJXx51QKcbervpkBK931H1A9F39z5E1XD',
  xPubKeySignature: '3045022100ed04aca131acf6f030018a7e3dd564788bbad5528e9edb7880f032ae6917bf10022022879ca8a60700c9c3bf9d603ae2555d4be1914084c912579b4bc09a432e9c32',
}, {
  id: '024062aae3d6575b03a8532e618feeb70d6926c069e24cca0cb1a24db4dec6562e',
  xPrivKey: 'xprv9s21ZrQH143K3dHn6j7zuLSnnMpBAceHfQFDm6R3wbkD26pTSUuZ7JY4549T8mMhwwUeq6SW6guDwy6cUhqs6PwoF2svKKkLjJdeKi1BzUn',
  xPubKey: 'xpub661MyMwAqRbcG7NFCkf1GUPXLPefa5N92dApZUpfVwHBtu9bz2Dof6rXvKjioVpLXRBHKeyX2AxLdtaCbUtz2zx3dE9F4mPkDsARrPaGsSL',
  xPubKeySignature: '3045022100a17dee46810e379aa37104ec1a4e20276aa41eac67b7e555475b15db6f6ee8ca0220472d114368f6d78bd8dba5c5fed77b22437341621d7879331bc48f7ee7701853',
}, {
  id: '031114b2afe5d1e87d834ac71798028724f8f89e2d3324b5e6abb513fdcde2e69d',
  xPrivKey: 'xprv9s21ZrQH143K3Wac3NKJ8nZsBsn4HboPtCD2LDB8zkXcmo9q97efAi9i6KkcyBoJ4vjD59corGsdJebmNXud4nH3bCBSo64uWfwauo3Kdco',
  xPubKey: 'xpub661MyMwAqRbcFzf59PrJVvWbjucYh4XFFR8d8bakZ64bebUygexuiWUBwa7EnFosoFstoocLQTrLPeAQThonSrYTDQ18gkS219dLJuwUHDb',
  xPubKeySignature: '30440220023c1902434aaca0c2ed3c92262d56ee4296cd5c7598b009b8556deab2df89e70220714117970debf5cc1232441aa2d1ce335b5b99958acb2d000c4241e2a2fc567f',
}, {
  id: '03d5352705f1f587dad9814cbdae1ec627a9252f18ca677cd9d5243d41d44a7fea',
  xPrivKey: 'xprv9s21ZrQH143K2Hxh1Xj59WjAimbDuubNBFknLYPr563BBziVuLhMvw7F3CkYMYj1y6QSbDnKQVHrMGekXi7awjLwKR1XWcMoR3eKEcH65Pa',
  xPubKey: 'xpub661MyMwAqRbcEn3A7ZG5WefuGoRiKNKDYUgP8voTdRaA4o3eSt1cUjRitVc75a2gsifRDufbicYXeQCchDvkRKSSTWi1uy7PPaNHnerGvTa',
  xPubKeySignature: '3044022042f063cd154a359f1d49202d79efc0737c47077ee50e36ed3d796327b9b29a9602206a4baf2902b49d1cb265eb31b9ab12d470fd023a11d9d425679a1630ba0b0e29',
}, {
  id: '036fa483c6f226afecb2782a69ab11d1cf43c26f277280cb2ec69f88681d8a4418',
  xPrivKey: 'xprv9s21ZrQH143K2L2wxVQ5nJ8FrTjz2KHB4wy83Xu6y6jdxmzrKNWvh6g7apPJqwj5NjhrmyJ6TYe9Hk4fbYx4tRg7Zk4Y7dAdgej4RVeUBTn',
  xPubKey: 'xpub661MyMwAqRbcEp7R4Ww69S4zQVaURn12SAtiqvJiXSGcqaKzruqBEtzbS97V145KiYxsW4g9M3pqsibfc5mtbMn4R52v7bnnrHGAoiHb1pz',
  xPubKeySignature: '304402207b082a63fc39b90a0f18edeb20d191430f11a9e5378681f15a68aac052aa858202201fd127b374e4a301a45f0c73d2a747d156a60075e643308e489a672bd0a7b4fb',
}, {
  id: '03bc5f0504c8dd480926dbe90449ccc7b2fc4c96e79f1cb8ffcd31731e2ee8db9b',
  xPrivKey: 'xprv9s21ZrQH143K3Pqe7LhTkE84VM6GysvSvggfhS3KbHvgBLaaQeR9YNePRo3vpLMVBv5SNhNVAaEDyj6Q8vMRVYM4X9bWYCiPgsJXkH8WzX1',
  xPubKey: 'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9',
  xPubKeySignature: '30440220192ae7345d980f45f908bd63ccad60ce04270d07b91f1a9d92424a07a38af85202201591f0f71dd4e79d9206d2306862e6b8375e13a62c193953d768e884b6fb5a46',
}, {
  id: '02ec9ec4fd013c67312e0365128d470a89e13e53d9b44f026c5eca0b6e2ab9ae29',
  xPrivKey: 'xprv9s21ZrQH143K2QSAHGxQhUsJYFDcZ6h2oiTjKFPmbnzeNzXgRW73NwX7ifBgbJ35eHGR7toyj9CCXB6Wzf5iCjj3YDuJuvBoJFJsiQAdTUH',
  xPubKey: 'xpub661MyMwAqRbcEtWdPJVR4cp36H46xZQtAwPL7doPA8XdFnrpy3RHvjqbZxERYNMd4E2tt84xy4F2PqtKkHFDzZbSAaUabp36oZDwwPEqFjK',
  xPubKeySignature: '304502210081a88684d4e27cab752d0df6a746aeb4bbcac57e73edd3847ffb43f1cf6740b20220312598f47dc5e775ea2ba97048764675afa4796173115049b4dacc8882b5c7b7',
}, {
  id: '02ec5f9178f77b306bc92362f3c1ef8f10b8cce44dc255ba20435f24d6459981db',
  xPrivKey: 'xprv9s21ZrQH143K2bj7Azs1rCkumDJmbNveDA96wDJThzsDEJjBngkFXEr646AbvrTAfRd2scqq7hN48fGXesobx4sKRkddCrLaCpoWUkMJErj',
  xPubKey: 'xpub661MyMwAqRbcF5oaH2Q2DLheKF9FzqeVaP4hjbi5GLQC774LLE4W53AZuMztQ6e6SMmEMj8K8zsP3iMMnJgK2PawWZCh7QcdgAg7eJWSJFr',
  xPubKeySignature: '304402207781231f8bd9a679938057373702afdeec43e84b5b239e2e4dc8e35c63e4ee7102207f7ed929c81dfb59ebd14f56609dcd8255de6337c967704340a2089080fd896f',
}, ];


var history = [{
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
  confirmations: 2,
  time: 1424471041,
  blocktime: 1424471041,
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
  confirmations: 1,
  time: 1424472242,
  blocktime: 1424472242,
  valueOut: 0.00031454,
  valueIn: 0.00045753,
  fees: 0.00014299
}];

module.exports.keyPair = keyPair;
module.exports.message = message;
module.exports.copayers = copayers;
module.exports.history = history;
