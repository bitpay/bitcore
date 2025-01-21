import _ from 'lodash';
import { V8 } from './blockchainexplorers/v8';
import { ChainService } from './chain/index';

const $ = require('preconditions').singleton();
const Common = require('./common');
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
    xec: {
      livenet: 'http://localhost:3000',
      testnet: 'http://localhost:3000'
    },
    eth: {
      livenet: 'https://api-eth.bitcore.io',
      testnet: 'https://api-eth.bitcore.io'
    },
    xrp: {
      livenet: 'https://api-xrp.bitcore.io',
      testnet: 'https://api-xrp.bitcore.io'
    },
    doge: {
      livenet: 'https://api.bitpay.com',
      testnet: 'https://api.bitpay.com'
    },
    xpi: {
      livenet: 'http://localhost:3000',
      testnet: 'http://localhost:3000'
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
  const url = opts.url || PROVIDERS[provider]?.[chain]?.[network];

  $.checkState(url, `No url found for provider: ${provider}:${chain}:${network}`);

  if (chain != 'bch' && chain != 'xec' && opts.addressFormat)
    throw new Error('addressFormat only supported for bch and xec');

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
      throw new Error(`Provider not supported: ${provider}`);
  }
}
