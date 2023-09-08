import _ from 'lodash';
import { V8 } from './blockchainexplorers/v8';
import { ChainService } from './chain/index';
import { Common } from './common';

const $ = require('preconditions').singleton();
const Defaults = Common.Defaults;
const PROVIDERS = {
  v8: {
    btc: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    },
    bch: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    },
    eth: {
      livenet: 'https://api-eth.bitcore.io',
      testnet: 'https://api-eth.bitcore.io'
    },
    matic: {
      livenet: 'https://api-matic.bitcore.io',
      testnet: 'https://api-matic.bitcore.io'
    },
    xrp: {
      livenet: 'https://api-xrp.bitcore.io',
      testnet: 'https://api-xrp.bitcore.io'
    },
    doge: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    },
    ltc: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    }
  }
};

export function BlockChainExplorer(opts) {
  $.checkArgument(opts, 'Failed state: opts undefined at <BlockChainExplorer()>');

  const provider = opts.provider || 'v8';
  const chain = opts.chain?.toLowerCase() || ChainService.getChain(opts.coin); // getChain -> backwards compatibility
  const network = opts.network || 'livenet';

  $.checkState(PROVIDERS[provider], 'Provider ' + provider + ' not supported');
  $.checkState(_.includes(_.keys(PROVIDERS[provider]), chain), 'Chain ' + chain + ' not supported by this provider');

  $.checkState(
    _.includes(_.keys(PROVIDERS[provider][chain]), network),
    'Network ' + network + ' not supported by this provider for chain ' + chain
  );

  const url = opts.url || PROVIDERS[provider][chain][network];

  if (chain != 'bch' && opts.addressFormat) throw new Error('addressFormat only supported for bch');

  if (chain == 'bch' && !opts.addressFormat) opts.addressFormat = 'cashaddr';

  switch (provider) {
    case 'v8':
      return new V8({
        chain,
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
