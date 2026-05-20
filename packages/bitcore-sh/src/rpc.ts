import config from './config';
const { CryptoRpc } = require('../../crypto-rpc');

export const getRpc = (chain: string, network: string) => {
  if (!config[chain][network])
    return;
  const rpcConfig = config[chain][network];

  return new CryptoRpc({
    chain,
    protocol: rpcConfig.protocol || 'http',
    host: rpcConfig.host,
    port: rpcConfig.port,
    user: rpcConfig.username,
    pass: rpcConfig.password
  }).get(chain);
}

export const rpcMethods = Object.getOwnPropertyNames(CryptoRpc.prototype)
  .filter(p => typeof CryptoRpc.prototype[p] === 'function' && p !== 'constructor');
