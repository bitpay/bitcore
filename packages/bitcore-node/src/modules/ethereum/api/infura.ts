import Config from '../../../config';
import request from 'request';
export class Infura {
  static apiUrls = {
    mainnet: 'https://mainnet.infura.io/v3/',
    testnet: 'https://kovan.infura.io/v3/'
  };

  static getApiUrl(network: string) {
    const url = this.apiUrls[network];
    return url || this.apiUrls.mainnet;
  }

  static supportsNetwork(network: string) {
    const config = Config.chains.ETH;
    const networkConfig = config[network];
    if (!networkConfig.infura) {
      return false;
    }
    return !!this.apiUrls[network];
  }

  static broadcast(network: string, tx: string) {
    const apiUrl = this.getApiUrl(network);
    const options = {
      uri: apiUrl,
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [tx],
        id: 1
      }),
      json: true
    };
    return request(options);
  }
}
