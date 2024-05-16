import request = require('request');
import config from '../../../../config';
import { isDateValid } from '../../../../utils/check';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import { ErigonTraceResponse } from '../../evm/p2p/rpcs/erigonRpc';
import { EVMTransactionJSON, Transaction } from '../../evm/types';
import moralisChains from '../defaults';
import { ExternalApiStream as apiStream } from '../streams/apiStream';

const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': config.externalProviders?.moralis?.apiKey,
};

const getBlockByDate = async ({ chain, network, date }) => {
  if (!date || !isDateValid(date)) {
    throw new Error('Invalid date');
  }

  const query = transformQueryParams({ chain, network, args: { date } });
  const queryStr = buildQueryString(query);

  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${baseUrl}/dateToBlock${queryStr}`,
      headers
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    })
  });
}

const getBlockByHash = async ({ chain, network, blockId }) => {
  if (!blockId) {
    throw new Error('Invalid block number or hash string');
  }

  const chainId = getMoralisChainId(chain, network);

  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${baseUrl}/block/${blockId}?chain=${chainId}`,
      headers
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    })
  });
}

const getNativeBalanceByBlock = async ({ chain, network, block, addresses }) => {
  if (!block) {
    throw new Error('Invalid block number or hash string');
  }
  // 25 wallet addresses max per Moralis API docs
  const queryStr = buildQueryString({
    chain: getMoralisChainId(chain, network),
    wallet_address: addresses
  })

  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${baseUrl}/wallets/balances${queryStr}`,
      headers
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    })
  });
}

const streamTransactionsByAddress = ({ chain, network, address, args }): any => {
  if (!address) {
    throw new Error('Missing address');
  }

  const query = transformQueryParams({ chain, network, args }); // throws if no chain or network
  const queryStr = buildQueryString({
    ...query,
    order: args.order || 'DESC', // default to descending order
    limit: args?.page_limit || 10, // limit per request/page. total limit is checked in apiStream._read()
    nft_metadata: false,
    include_input_data: true,
    include_internal_transactions: true
  });
  args.transform = (tx) => {
    const _tx: any = transformTransaction({ chain, network, ...tx });
    const confirmations = calculateConfirmations(tx, args.tipHeight);
    return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true }) as EVMTransactionJSON;
  }

  return new apiStream(
    `${baseUrl}/wallets/${address}/history${queryStr}`,
    headers,
    args
  )
}

const streamERC20TransactionsByAddress = ({ chain, network, address, tokenAddress, args }): any => {
  if (!address) {
    throw new Error('Missing address');
  }
  if (!tokenAddress) {
    throw new Error('Missing token address');
  }

  const queryTransform = transformQueryParams({ chain, network, args }); // throws if no chain or network
  const queryStr = buildQueryString({
    ...queryTransform,
    order: args.order || 'DESC', // default to descending order
    limit: args?.page_limit || 10, // limit per request/page. total limit is checked in apiStream._read()
    contract_addresses: [tokenAddress],
  });
  args.transform = (tx) => {
    const _tx: any = transformTokenTransfer({ chain, network, ...tx });
    const confirmations = calculateConfirmations(tx, args.tipHeight);
    return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true }) as EVMTransactionJSON;
  }

  return new apiStream(
    `${baseUrl}/${address}/erc20/transfers${queryStr}`,
    headers,
    args
  )
}

const transformTransaction = (tx) => {
  return {
    chain: tx.chain,
    network: tx.network,
    txid: tx.hash,
    blockHeight: Number(tx.block_number),
    blockHash: tx.block_hash,
    blockTime: new Date(tx.block_timestamp),
    blockTimeNormalized: new Date(tx.block_timestamp),
    value: tx.value,
    gasLimit: tx.gas,
    gasPrice: tx.gas_price,
    fee: Number(tx.receipt_gas_used) * Number(tx.gas_price),
    nonce: tx.nonce,
    to: tx.to_address,
    from: tx.from_address,
    data: tx.input,
    internal: tx?.internal_transactions.map(t => transformInternalTransaction(t)),
    effects: tx.effects,
  };
}

const transformInternalTransaction = (tx) => {
  return {
    action: {
      callType: tx.type?.toLowerCase(),
      from: tx.from,
      gas: tx.gas,
      input: tx.input,
      to: tx.to,
      value: tx.value,
    },
    blockHash: tx.block_hash,
    blockNumber: Number(tx.block_number),
    error: tx.error,
    result: {
      gasUsed: tx.gas_used,
      output: tx.output
    },
    subtraces: tx.subtraces,
    traceAddress: tx.traceAddress || [],
    transactionHash: tx.transaction_hash,
    transactionPosition: tx.transactionPosition || 0,
    type: tx.type?.toLowerCase()
  } as ErigonTraceResponse;
}

const transformTokenTransfer = (transfer) => {
  let _transfer = transformTransaction(transfer);
  return {
    ..._transfer,
    transactionHash: transfer.transaction_hash,
    transactionIndex: transfer.transaction_index,
    contractAddress: transfer.contract_address,
    name: transfer.token_name
  } as Partial<Transaction> | any;
}

const transformQueryParams = (params) => {
  const { chain, network, args } = params;
  let query = {
    chain: getMoralisChainId(chain, network),
  } as any;
  if (args) {
    if (args.startBlock || args.endBlock) {
      if (args.startBlock) {
        query.from_block = Number(args.startBlock);
      }
      if (args.endBlock) {
        query.to_block = Number(args.endBlock);
      }
    } else {
      if (args.startDate) {
        query.from_date = args.startDate
      }
      if (args.endDate) {
        query.to_date = args.endDate;
      }
    }
    if (args.direction) {
      query.order = Number(args.direction) > 0 ? 'ASC' : 'DESC';
    }
    if (args.date) {
      query.date = new Date(args.date).getTime();
    }
  }
  return query;
}

const getMoralisChainId = (chain, network): string | Error => {
  if (!chain) {
    throw new Error('Missing chain');
  }
  if (!network) {
    throw new Error('Missing network');
  }

  chain = chain.toUpperCase();
  network = network.toLowerCase();

  if (network === 'testnet') {
    network = moralisChains[chain]?.testnet;
  }
  if (!moralisChains[chain][network]) {
    throw new Error(`${chain}:${network} is not supported`);
  }

  return moralisChains[chain][network];
}

const calculateConfirmations = (tx, tip) => {
  let confirmations = 0;
  if (tx.blockHeight && tx.blockHeight >= 0) {
    confirmations = tip - tx.blockHeight + 1;
  }
  return confirmations;
}

const buildQueryString = (params: Record<string, any>): string => {
  const query: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        // add array values in the form of key[i]=value
        if (value[i] != null) query.push(`${key}%5B${i}%5D=${value[i]}`);
      }
    } else if (value != null) {
      query.push(`${key}=${value}`);
    }
  }

  return query.length ? `?${query.join('&')}` : '';
}

const MoralisAPI = {
  getBlockByDate,
  getBlockByHash,
  getNativeBalanceByBlock,
  streamTransactionsByAddress,
  streamERC20TransactionsByAddress
}

export default MoralisAPI;