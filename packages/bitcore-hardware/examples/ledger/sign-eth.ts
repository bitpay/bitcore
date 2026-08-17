import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Ledger from '../../src/ledger.js';

const ledger = new Ledger();
await ledger.connect();

const tx = CWC.Transactions.create({
  chain: 'ETH',
  recipients: [{ address: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 3896000000000000 }],
  nonce: 0,
  gasPrice: 21000,
  data: '0x'
});

console.log(`Sign ${tx}`);
const signedTransaction = await ledger.signEth(tx);

console.log('Signed transaction');
console.log(signedTransaction);

await ledger.disconnect();
process.exit(0);
