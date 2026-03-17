/* eslint-disable @typescript-eslint/no-require-imports */
class LibProvider {
  libs = {
    BTC: {
      lib: require('@bitpay-labs/crypto-wallet-core').BitcoreLib,
      p2p: require('@bitpay-labs/bitcore-p2p')
    }
  };

  register(chain: string, lib: string, p2p: string) {
    this.libs[chain] = { lib: require(lib), p2p: require(p2p) };
  }

  get(chain) {
    return this.libs[chain];
  }
}

export const Libs = new LibProvider();
