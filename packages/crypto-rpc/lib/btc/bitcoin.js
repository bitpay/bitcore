import bitcoinDRPC from 'bitcoind-rpc';
import promptly from 'promptly';

export class BitcoinRPC extends bitcoinDRPC {
  constructor (opts) {
    const args = { protocol: opts?.protocol }; // to allow nodes without ssl (protocol: 'http')
    super(args);

    opts = opts || {};
    this.host = opts.host;
    this.port = opts.port;
    this.user = opts.user;
    this.pass = opts.pass;
    this.httpOptions = { rejectUnauthorized: false };
  }

  cmdlineUnlock(timeout, callback) {
    this.getWalletInfo((err, result) => {
      if (err) {
        console.error(err);
        return callback(err);
      }
      if ('unlocked_until' in result.result) {
        if (result['unlocked_until']) {
          throw new Error('wallet is currently unlocked');
        }
        promptly.password('> ', (err, phrase) => {
          if (err) {
            return callback(err);
          }
          this.walletPassPhrase(phrase, timeout, (err) => {
            if (err) {
              return callback(err);
            } else {
              console.warn('wallet unlocked for ' + timeout + ' seconds');
              return callback(null, (doneLocking) => {
                this.walletLock((err) => {
                  if (err) {
                    console.error(err.message);
                  } else {
                    console.error('wallet locked');
                  }
                  if (doneLocking) doneLocking();
                });
              });
            }
          });
        });
      } else {
        process.nextTick(function() {
          callback(null, function(doneLocking) {
            if (doneLocking) {
              process.nextTick(doneLocking);
            }
          });
        });
      }
    });
  }
};
