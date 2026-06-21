import config from './config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CryptoRpc } = require('../../crypto-rpc');

class Rpc {
  methods: string[] = Object.getOwnPropertyNames(CryptoRpc.prototype)
    .filter(p => typeof CryptoRpc.prototype[p] === 'function' && p !== 'constructor');

  get(chain: string, network: string) {
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
  };

  getMethodParams(chain: string, network: string, rpcMethod: string): string[] {
    const rpc = this.get(chain, network);
    if (!rpc || !rpc[rpcMethod])
      return [];
    const methodString = rpc[rpcMethod].toString();
    const match = methodString.match(/\{\s*([^}]+)\s*\}/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map((key: string) => key.trim())
      .map((key: string) => '--' + (key.substring(0, key.indexOf(' ')) || key))
      .filter((key: string) => key);
  };
}

const RPC = new Rpc();
export default RPC;
