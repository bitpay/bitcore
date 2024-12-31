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
  },
  ARB: {
    default: "m/44'/60'/",
  },
  OP: {
    default: "m/44'/60'/",
  },
  BASE: {
    default: "m/44'/60'/",
  },
  SOL: {
    default: "m/44'/501'/",
  },
  default: {
    testnet: "m/44'/1'/"
  }
};
