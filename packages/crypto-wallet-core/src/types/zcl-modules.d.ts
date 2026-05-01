declare namespace ZclassicBitcoreLib {
  type Transaction = any;
  namespace Transaction {
    type Signature = any;
    type UnspentOutput = any;
  }
  type Address = any;
  type HDPrivateKey = any;
  type HDPublicKey = any;
  type PrivateKey = any;
  type PublicKey = any;
  type Script = any;
  type Networks = any;
  namespace crypto {
    type Signature = any;
  }
  type crypto = any;
  type util = any;
  type encoding = any;
  type Unit = any;
  type Opcode = any;
}

declare module 'zclassic-bitcore-lib' {
  const lib: any;
  export = lib;
}

declare module 'bitcore-lib' {
  const bitcore: any;
  export = bitcore;
}
