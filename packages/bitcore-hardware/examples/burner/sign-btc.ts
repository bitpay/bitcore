import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const burner = new Burner();
burner.connect();

// utxo from https://api.bitcore.io/api/BTC/mainnet/address/bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk/coins
const utxos = [
  {
    chain: 'BTC',
    network: 'mainnet',
    coinbase: false,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '3f91933d95a2025e10f6a3c4d332c693921550036b1c2e9c2625189b4f49d6e4',
    mintHeight: 956531,
    spentHeight: -2,
    address: 'bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk',
    script: '001456c5557b413096aa9ce65ef7f2e6133df73bca8b',
    value: 8050,
    confirmations: -1
  }
];

const tx: string = CWC.Transactions.create({
  chain: 'BTC',
  recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: 7800 }],
  utxos
});

console.log('Tap burner wallet on an NFC reader to sign a transaction');
const signedTransaction: any = await burner.sign({
  chain: 'BTC',
  tx,
  utxos,
  index: 9,
  password: '123456'
});

console.log('Signed transaction');
console.log(signedTransaction);
// view transaction on https://bitpay.com/insight/BTC/mainnet/tx/13468b95f83bd346ddd96fafa145d078da9265529829c7fa43324cfba557b243

process.exit(0);
