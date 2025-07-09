import { V8 } from './blockchainexplorers/v8';
import { ChainService } from './chain/index';

const $ = require('preconditions').singleton();

const PROVIDERS = {
  v8: {
    btc: {
      livenet: 'https://api.bitcore.io',
      testnet3: 'https://api.bitcore.io'
    },
    bch: {
      livenet: 'https://api.bitcore.io',
      testnet3: 'https://api.bitcore.io'
    },
    doge: {
      livenet: 'https://api.bitcore.io',
      testnet3: 'https://api.bitcore.io'
    },
    ltc: {
      livenet: 'https://api.bitcore.io',
      testnet4: 'https://api.bitcore.io'
    },
    xrp: {
      livenet: 'https://api-xrp.bitcore.io',
      testnet: 'https://api-xrp.bitcore.io'
    },
    eth: {
      livenet: 'https://api-eth.bitcore.io',
      sepolia: 'https://api-eth.bitcore.io'
    },
    matic: {
      livenet: 'https://api-matic.bitcore.io',
      amoy: 'https://api-matic.bitcore.io'
    },
    arb: {
      livenet: 'https://api-eth.bitcore.io',
      sepolia: 'https://api-eth.bitcore.io'
    },
    base: {
      livenet: 'https://api-eth.bitcore.io',
      sepolia: 'https://api-eth.bitcore.io'
    },
    op: {
      livenet: 'https://api-eth.bitcore.io',
      sepolia: 'https://api-eth.bitcore.io'
    },
    sol: {
      livenet: 'https://api-sol.bitcore.io',
      testnet: 'https://api-sol.bitcore.io',
      devnet: 'https://api-sol.bitcore.io'
    },
  }
};

export function BlockChainExplorer(opts): V8 {
  $.checkArgument(opts, 'Failed state: opts undefined at <BlockChainExplorer()>');

  const provider = opts.provider || 'v8';
  const chain = opts.chain?.toLowerCase() || ChainService.getChain(opts.coin); // getChain -> backwards compatibility
  const network = opts.network || 'livenet';
  const url = opts.url || PROVIDERS[provider]?.[chain]?.[network];

  $.checkState(url, `No url found for provider: ${provider}:${chain}:${network}`);

  if (chain != 'bch' && opts.addressFormat) { throw new Error('addressFormat only supported for bch'); }
  if (chain == 'bch' && !opts.addressFormat) { opts.addressFormat = 'cashaddr'; }

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
