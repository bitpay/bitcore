import request = require('request');
import config from '../../../config';
import { isDateValid } from '../../../utils/check';
import moralisChains from './defaults';

const version = config.externalProviders?.moralis.apiVersion;

const getBlockByDate = async ({ chain, network, date }) => {
  if (!date || !isDateValid(date) ) {
    return new Error('Invalid date');
  }  
  const chainId = moralisChains[chain][network];
  const unixTime = new Date(date).getTime();
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `https://deep-index.moralis.io/api/v${version}/dateToBlock?chain=${chainId}&date=${unixTime}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.externalProviders?.moralis.apiKey,
      }
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
    return new Error('Invalid block number or hash string');
  }
  const chainId =  getMoralisChainId(chain, network);
  return new Promise((resolve, reject) => {
    request({ 
      method: 'GET',
      url: `https://deep-index.moralis.io/api/v${version}/block/${blockId}?chain=${chainId}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.externalProviders?.moralis.apiKey,
      }
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    })
  });
}

const getMoralisChainId = (chain, network) : string | Error => {
  if (!chain) {
    return new Error('Invalid chain');
  }
  if (!network) {
    return new Error('Invalid network');
  }

  chain = chain.toUpperCase();
  network = network.toLowerCase();

  if (network === 'testnet') {
    network = moralisChains[chain]?.testnet;
  }
  if (!moralisChains[chain][network]) {
    return new Error('Invalid network');
  }

  return moralisChains[chain][network];
}

const MoralisAPI = {
  getBlockByDate,
  getBlockByHash
}

export default MoralisAPI;