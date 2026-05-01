/* eslint-disable @typescript-eslint/no-require-imports */
class LibProvider {
  private _libs: Record<string, { lib: any; p2p: any }> | null = null;

  private get libs() {
    if (!this._libs) {
      this._libs = {
        BTC: {
          lib: require('@bitpay-labs/crypto-wallet-core').BitcoreLib,
          p2p: require('@bitpay-labs/bitcore-p2p')
        }
      };
      try {
        this._libs['ZCL'] = {
          lib: require('zclassic-bitcore-lib'),
          p2p: require('zclassic-bitcore-p2p')
        };
      } catch {
        // zclassic-bitcore-lib not available in this environment
      }
    }
    return this._libs;
  }

  register(chain: string, lib: string, p2p: string) {
    this.libs[chain] = { lib: require(lib), p2p: require(p2p) };
  }

  get(chain) {
    return this.libs[chain];
  }
}

export const Libs = new LibProvider();
