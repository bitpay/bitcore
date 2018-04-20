const EthereumTx = const Web3 = require('web3-eth');
const config = require('bitcore-node/lib/config');
require('ethereumjs-tx');

export default class ETHTxProvder {

  constructor(chain) {
    this.chain = chain || 'ETH';
    this.chain = this.chain.toUpperCase();
    this.config = config.chains[this.chain];
  }
  web3For(network) {
    const networkConfig = this.config[network];
    const provider = networkConfig.provider;
    const portString = provider.port ? `:${provider.port}` : '';
    const connUrl = `${provider.protocool}://${provider.host}${portString}`;
    let ProviderType;
    switch(provider.protocool) {
      case 'wss':
        ProviderType = Web3.providers.WebsocketProvider;
        break;
      default:
        ProviderType = Web3.providers.HttpProvider;
        break;
    }
    return new Web3(new ProviderType(connUrl));
    //return new Web3(connUrl);
  };

  async create({ network, addresses, amount }) {
    var nonce = await this.web3For(network).eth.getTransactionCountAsync(addresses);
    var tx = new Transaction({
      to: addresses,
      value: amount,
      nonce: nonce,
      gasLimit: 2000000
    });
    return tx;
  }
}
