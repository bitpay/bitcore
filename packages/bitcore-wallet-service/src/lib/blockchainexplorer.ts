import _ from 'lodash';
import { V8 } from './blockchainexplorers/v8';

const $ = require('preconditions').singleton();
const Common = require('./common');
const Defaults = Common.Defaults;
let log = require('npmlog');
log.debug = log.verbose;

const PROVIDERS = {
  v8: {
    btc: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    },
    bch: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    }
  }
};

export function BlockChainExplorer(opts) {
  $.checkArgument(opts);

  const provider = opts.provider || 'v8';
  const coin = opts.coin || Defaults.COIN;
  const network = opts.network || 'livenet';

  $.checkState(PROVIDERS[provider], 'Provider ' + provider + ' not supported');
  $.checkState(
    _.includes(_.keys(PROVIDERS[provider]), coin),
    'Coin ' + coin + ' not supported by this provider'
  );

  $.checkState(
    _.includes(_.keys(PROVIDERS[provider][coin]), network),
    'Network ' + network + ' not supported by this provider for coin ' + coin
  );

  const url = opts.url || PROVIDERS[provider][coin][network];

  if (coin != 'bch' && opts.addressFormat)
    throw new Error('addressFormat only supported for bch');

  if (coin == 'bch' && !opts.addressFormat) opts.addressFormat = 'cashaddr';

  switch (provider) {
    case 'v8':
      return new V8({
        coin,
        network,
        url,
        apiPrefix: opts.apiPrefix,
        userAgent: opts.userAgent,
        addressFormat: opts.addressFormat
      });

    default:
      throw new Error('Provider ' + provider + ' not supported.');
  }
}
