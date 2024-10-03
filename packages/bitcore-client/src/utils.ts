import https from 'https';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const getCurrencies = async (): Promise<any[]> => {
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

export const getCurrencyObj = async (chain: string, contractAddress: string) => {
  const currencies = await getCurrencies();
  if (contractAddress) {
    return currencies.find(c => c.chain === chain && c.contractAddress === contractAddress);
  }
  return currencies.find(c => c.chain === chain && c.native);
}