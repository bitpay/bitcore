export const Paths = {
  BTC: {
    mainnet: "m/44'/0'/",
    livenet: "m/44'/0'/",
    default: "m/44'/1'/"
  },
  BCH: {
    mainnet: "m/44'/145'/",
    livenet: "m/44'/145'/",
    default: "m/44'/1'/"
  },
  ETH: {
    default: "m/44'/60'/"
  },
  XRP: {
    default: "m/44'/144'/"
  },
  DOGE: {
    default: "m/44'/3'/"
  },
  LTC: {
    default: "m/44'/2'/"
  },
  MATIC: {
    default: "m/44'/60'/", // the official matic derivation path is 966 but users will expect address to be same as ETH
    mainnet: "m/44'/60'/", // the official matic derivation path is 966 but users will expect address to be same as ETH
    livenet: "m/44'/60'/",
    testnet: "m/44'/60'/"
  },
  ARB: {
    mainnet: "m/44'/60'/",
    livenet: "m/44'/60'/",
    testnet: "m/44'/60'/"
  },
  OP: {
    mainnet: "m/44'/60'/",
    livenet: "m/44'/60'/",
    testnet: "m/44'/60'/"
  },
  BASE: {
    mainnet: "m/44'/60'/",
    livenet: "m/44'/60'/",
    testnet: "m/44'/60'/"
  },
  default: {
    testnet: "m/44'/1'/"
  }
};
