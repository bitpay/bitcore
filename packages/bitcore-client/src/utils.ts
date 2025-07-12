import https from 'https';

class Utils {

  sleep(ms): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  async getCurrencies(test?: boolean): Promise<any[]> {
    const baseUrl = process.env.BITPAY_BASEURL || `https://${test ? 'test.' : ''}bitpay.com`;
    const data = await new Promise<string>((resolve, reject) => {
      https.get(`${baseUrl}/currencies`, res => {
        if (res.statusCode !== 200) {
          reject(new Error('Request Failed'));
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data.toString()));
      });
    });
    return JSON.parse(data).data;
  }

  async getCurrencyObj(chain: string, contractAddress: string, test?: boolean) {
    const currencies = await this.getCurrencies(test);
    if (contractAddress) {
      return currencies.find(c => c.chain === chain && c.contractAddress === contractAddress);
    }
    return currencies.find(c => c.chain === chain && c.native);
  }
}

export const utils = new Utils();
