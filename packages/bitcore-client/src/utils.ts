import https from 'https';

class Utils {

  sleep(ms): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  async getCurrencies(): Promise<any[]> {
    const data = await new Promise<string>((resolve, reject) => {
      https.get('https://bitpay.com/currencies', res => {
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

  async getCurrencyObj(chain: string, contractAddress: string) {
    const currencies = await this.getCurrencies();
    if (contractAddress) {
      return currencies.find(c => c.chain === chain && c.contractAddress === contractAddress);
    }
    return currencies.find(c => c.chain === chain && c.native);
  }
}

export const utils = new Utils();
