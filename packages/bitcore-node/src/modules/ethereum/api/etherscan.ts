import Config from '../../../config';
import request from 'request';
export class Etherscan {
  static apiUrls = {
    mainnet: 'https://api.etherscan.io/',
    testnet: 'https://api-kovan.etherscan.io/'
  };

  static getApiUrl(network: string) {
    const url = this.apiUrls[network];
    return url || this.apiUrls.mainnet;
  }

  static supportsNetwork(network: string) {
    const config = Config.chains.ETH;
    const networkConfig = config[network];
    if (!networkConfig.etherscan) {
      return false;
    }
    return !!this.apiUrls[network];
  }

  static broadcast(network: string, tx: string) {
    const apiUrl = this.getApiUrl(network);
    return request({ url: apiUrl + `api?module=proxy&action=eth_sendRawTransaction&hex=${tx}` });
  }
}
