import Moralis from 'moralis';
import config from '../../config';
import { ClientError } from '../errors/clienterror';
import { checkRequired } from './shared';
import type { WalletService } from '../server';

export function getWalletTokenBalances(_service: WalletService, req): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: req.body.address,
        chain: req.body.chain,
        toBlock: req.body.toBlock,
        tokenAddresses: req.body.tokenAddresses,
        excludeSpam: req.body.excludeSpam
      });

      return resolve(response.raw ?? response);
    } catch (err) {
      return reject(err);
    }
  });
}

export function getTokenAllowance(service: WalletService, req): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!config.moralis) return reject(new Error('Moralis missing credentials'));
    if (!checkRequired(req.body, ['address']) && !checkRequired(req.body, ['ownerAddress'])) {
      return reject(new ClientError('moralisGetTokenAllowance request missing arguments'));
    }

    const walletAddress = req.body.ownerAddress ?? req.body.address;
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': config.moralis.apiKey
    };

    const qs = [];
    if (req.body.chain) {
      const chain = req.body.chain;
      const formattedChain = typeof chain === 'number' && Number.isInteger(chain) ? `0x${chain.toString(16)}` : chain;
      qs.push(`chain=${formattedChain}`);
    }
    if (req.body.cursor) qs.push('cursor=' + req.body.cursor);
    if (req.body.limit) qs.push('limit=' + req.body.limit);

    const url = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/approvals${qs.length > 0 ? '?' + qs.join('&') : ''}`;

    service.request.get(
      url,
      {
        headers,
        json: true
      },
      (err, data) => {
        if (err) {
          return reject(err.body ?? err);
        }

        const { spenderAddress, ownerAddress, address } = req.body;
        if (spenderAddress && ownerAddress) {
          const spendersList = data?.body?.result;
          if (Array.isArray(spendersList)) {
            const spenderData = spendersList.find(
              s =>
                s.spender?.address?.toLowerCase() === spenderAddress.toLowerCase() &&
                s.token?.address?.toLowerCase() === address.toLowerCase()
            );

            data.body = {
              allowance: spenderData?.value ?? '0'
            };
          }
        }

        return resolve(data.body ?? data);
      }
    );
  });
}

export function getNativeBalance(_service: WalletService, req): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await Moralis.EvmApi.balance.getNativeBalance({
        address: req.body.address,
        chain: req.body.chain,
        toBlock: req.body.toBlock
      });

      return resolve(response.raw ?? response);
    } catch (err) {
      return reject(err);
    }
  });
}

export function getTokenPrice(_service: WalletService, req): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await Moralis.EvmApi.token.getTokenPrice({
        address: req.body.address,
        chain: req.body.chain,
        include: req.body.include,
        exchange: req.body.exchange,
        toBlock: req.body.toBlock
      });

      return resolve(response.raw ?? response);
    } catch (err) {
      return reject(err);
    }
  });
}

export function getMultipleERC20TokenPrices(_service: WalletService, req): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await Moralis.EvmApi.token.getMultipleTokenPrices(
        {
          chain: req.body.chain,
          include: req.body.include
        },
        {
          tokens: req.body.tokens
        }
      );

      return resolve(response.raw ?? response);
    } catch (err) {
      return reject(err);
    }
  });
}

export function getERC20TokenBalancesWithPricesByWallet(service: WalletService, req): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!config.moralis) return reject(new Error('Moralis missing credentials'));
    if (!checkRequired(req.body, ['address'])) {
      return reject(new ClientError('moralisGetERC20TokenBalancesWithPricesByWallet request missing arguments'));
    }

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': config.moralis.apiKey
    };

    const qs = [];
    if (req.body.chain) qs.push('chain=' + req.body.chain);
    if (req.body.toBlock) qs.push('to_block=' + req.body.toBlock);
    if (req.body.tokenAddresses) qs.push('token_addresses=' + req.body.tokenAddresses);
    if (req.body.excludeSpam) qs.push('exclude_spam=' + req.body.excludeSpam);
    if (req.body.cursor) qs.push('cursor=' + req.body.cursor);
    if (req.body.limit) qs.push('limit=' + req.body.limit);
    if (req.body.excludeNative) qs.push('exclude_native=' + req.body.excludeNative);

    const url = `https://deep-index.moralis.io/api/v2.2/wallets/${req.body.address}/tokens${qs.length > 0 ? '?' + qs.join('&') : ''}`;

    service.request.get(
      url,
      {
        headers,
        json: true
      },
      (err, data) => {
        if (err) {
          return reject(err.body ?? err);
        }
        return resolve(data.body ?? data);
      }
    );
  });
}

export function getSolWalletPortfolio(_service: WalletService, req): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let network;
    const chain = req.body.network ?? req.body.chain ?? undefined;
    const formattedChain = typeof chain === 'number' && Number.isInteger(chain) ? `0x${chain.toString(16)}` : chain;

    switch (formattedChain) {
      case '0x65':
      case 'devnet':
        network = 'devnet';
        break;
      case '0x66':
      case 'testnet':
        network = 'testnet';
        break;
      default:
        network = 'mainnet';
        break;
    }

    try {
      const response = await Moralis.SolApi.account.getPortfolio({
        address: req.body.address,
        network
      });

      return resolve(response.raw ?? response);
    } catch (err) {
      return reject(err);
    }
  });
}
