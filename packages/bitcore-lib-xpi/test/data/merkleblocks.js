'use strict';

module.exports = {
  TXHEX: [
    [ // From Mainnet Block 15290
      // From: https://explorer.givelotus.org/api/getrawtransaction?txid=0d2f101fa45d562a1915996caca920307db1e4970066c83e90754b44bcea7e67&decrypt=0
      "02000000010000000000000000000000000000000000000000000000000000000000000000ffffffff020000ffffffff0f00000000000000000a6a056c6f676f7302ba3bfd359236000000001976a9148d91da546b8689c0b366e05b96fd1acb9c4f5b7688acb0a132040000000017a914b6c79031b71d86ab0d617e1e1e706ec4ee34b07f87b0a13204000000001976a914b8ae1c47effb58f72f7bca819fe7fc252f9e852e88acb0a13204000000001976a914b50b86a893d80c9e2ee72b199612374b7b4c1cd888acb0a13204000000001976a914da76a31b6760dcb90aa469c15965da6e80096e4588acb0a13204000000001976a9141325d2d8ba6e8c7d99ff66d21530917cc73429d288acb0a13204000000001976a9146a171891ab9443020bd2755ef79c6e59efc5926588acb0a13204000000001976a91419e8d8d0edab6ec43f04b656bff72af78d63ff6588acb0a13204000000001976a914c6492d4e44dcd0051e60a8add6af02b2f291b2aa88acb0a13204000000001976a914b5aeafec9f2972110c4c6af9508a3c41e1d3c73b88acb0a13204000000001976a9147c28aa91b93faf8aee0a6520a0a83f42dbc4a45b88acb0a13204000000001976a914b18eb08c4978e73480743b1598061d3cf38e10a888acb0a13204000000001976a9147d0893d1a278bab27e7ad92ed88bd7dceafd83a588acb0a13204000000001976a9144b869f9a55c57003df178bdc801184109d904f8b88ac00000000"
    ],
  ],
  HEX: [
    // Mainnet Block 15290
    "4f0bfafc3e3ab70f3e8741c7b74d068298f0ed33c86d9b7dd0b0390000000000" +        // prevHash
    "20223e1b" +                                                                // Bits
    "2218dc600000" +                                                            // Time
    "0000" +                                                                    // Reversed
    "183422810c648bcb" +                                                        // Nonce
    "01" +                                                                      // Version
    "a5030000000000" +                                                          // Size
    "ba3b0000" +                                                                // Height
    "63a3214bb079b14a6a30e47febaa0ecbe4ee557aa8992980ee37010000000000" +        // EpochBlock
    "7bc0e12a069b62f53acc37c9b911dddfb0860cf8af11fe0aa7c859e1fd05d88f" +        // MerkleRoot
    "1406e05881e299367766d313e26c05564ec91bf721d31726bd6e46e60689539a" +        // ExtendedMetadata
    "04000000" +                                                                // Transaction Count
      "03" +                                                                    // Hash Count
      "b155767806e59532bee1ae8fb9adb75111fdcec65fb53dfcd8483e338b519df3" +      // Hash Transaction 1
      "677eeabc444b75903ec8660097e4b17d3020a9ac6c9915192a565da41f102f0d" +      // Hash Transaction 2
      "9d45b8c1e16f2afad449ce0ad3bbf36c04e0eec9ecfb8d9d788fcc5f8c95ac8e" +      // Hash Transaction 3
      "01" +                                                                    // Num Flag Bytes
      "0b"                                                                      // Flags
  ],
  JSON: [
    { // Mainnet Block 15290
      header: {
        hash: "0000000000388126659ce43a6933bf0a10e63847489df8be552ec77b8f229839",
        prevHash: "000000000039b0d07d9b6dc833edf09882064db7c741873e0fb73a3efcfa0b4f",
        bits: 457056800,
        time: 1625036834,
        reserved: 0,
        nonce: "14666926616331039768",
        version: 1,
        size: 933,
        height: 15290,
        epochBlock: "00000000000137ee802999a87a55eee4cb0eaaeb7fe4306a4ab179b04b21a363",
        merkleRoot: "8fd805fde159c8a70afe11aff80c86b0dfdd11b9c937cc3af5629b062ae1c07b",
        extendedMetadata: "9a538906e6466ebd2617d321f71bc94e56056ce213d366773699e28158e00614"
      },
      numTransactions: 4,
      hashes: [
        "b155767806e59532bee1ae8fb9adb75111fdcec65fb53dfcd8483e338b519df3",
        "677eeabc444b75903ec8660097e4b17d3020a9ac6c9915192a565da41f102f0d",
        "9d45b8c1e16f2afad449ce0ad3bbf36c04e0eec9ecfb8d9d788fcc5f8c95ac8e"
      ],
      flags: [ 11 ]
    },
    { // Mainnet Block 22003
      header: {
        hash: "000000000019072db2834f8ed26ef6f0f2f3a4d9288f63176c5e82d9477ca397",
        prevHash: "0000000000030882116ee6f5963b9ed7c028845e55ec992c2a49abac0e1a52a0",
        bits: 456014208,
        time: 1625768825,
        reserved: 0,
        nonce: "12045594477943128845",
        version: 1,
        size: 2152,
        height: 22003,
        epochBlock: "000000000002b926066e364c16302ffe83b1b55040853ec76f45b7a4f2eca54a",
        merkleRoot: "3f2c344f3ec5d3e434c4772d36ee01971b575f513542cc723929105b458d7de6",
        extendedMetadata: "9a538906e6466ebd2617d321f71bc94e56056ce213d366773699e28158e00614"
      },
      numTransactions: 6,
      hashes: [
        "ebe885d1d9003636a0d1dbaca45f595a7e9eb36c10ff1c0aa0cff9f698a93a43",
        "8b5c233843e7074fd8d7df86eabc719594c23774e5693874edaee0e9fb9e78c9",
        "95116d3eb89c26f16399414b9aad492d868d1255eddb05d77fdcbe2f6ec3bfb4",
        "85d80c3a2a27e2f42940c71386f76f1c757e01fe7a7199ffb3b29a192e1f22f0"
      ],
      flags: [ 23 ]
    }
  ]
};
