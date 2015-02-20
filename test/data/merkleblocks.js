'use strict';

module.exports = {
  HEX: [
    // Mainnet Block 100015
    "01000000" + // Version
      "82bb869cf3a793432a66e826e05a6fc37469f8efb7421dc88067010000000000" + // prevHash
      "7f16c5962e8bd963659c793ce370d95f093bc7e367117b3c30c1f8fdd0d97287" + // MerkleRoot
      "76381b4d" + // Time
      "4c86041b" + // Bits
      "554b8529" + // Nonce
      "07000000" + // Transaction Count
      "04" + // Hash Count
      "3612262624047ee87660be1a707519a443b1c1ce3d248cbfc6c15870f6c5daa2" + // Hash1
      "019f5b01d4195ecbc9398fbf3c3b1fa9bb3183301d7a1fb3bd174fcfa40a2b65" + // Hash2
      "41ed70551dd7e841883ab8f0b16bf04176b7d1480e4f0af9f3d4c3595768d068" + // Hash3
      "20d2a7bc994987302e5b1ac80fc425fe25f8b63169ea78e68fbaaefa59379bbf" + // Hash4
      "01" + // Num Flag Bytes
      "1d" // Flags
  ],
  JSON: [
    { // Mainnet Block 100015
      header: {
        version: 1,
        prevHash: "82bb869cf3a793432a66e826e05a6fc37469f8efb7421dc88067010000000000",
        merkleRoot: "7f16c5962e8bd963659c793ce370d95f093bc7e367117b3c30c1f8fdd0d97287",
        time: 1293629558,
        bits: 453281356,
        nonce: 151839121
      },
      numTransactions: 7,
      hashes: [
        "3612262624047ee87660be1a707519a443b1c1ce3d248cbfc6c15870f6c5daa2",
        "019f5b01d4195ecbc9398fbf3c3b1fa9bb3183301d7a1fb3bd174fcfa40a2b65",
        "41ed70551dd7e841883ab8f0b16bf04176b7d1480e4f0af9f3d4c3595768d068",
        "20d2a7bc994987302e5b1ac80fc425fe25f8b63169ea78e68fbaaefa59379bbf"
      ],
      flags: [ 29 ]
  }



  ]
};
