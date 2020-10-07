class LibProvider {
  libs = {
    BTC: {
      lib: require('bitcore-lib'),
      p2p: require('bitcore-p2p')
    },
    BCH: {
      lib: require('bitcore-lib-cash'),
      p2p: require('bitcore-p2p-cash')
    },
    LTC: {
      lib: require('litecore-lib'),
      p2p: require('litecore-p2p')
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
