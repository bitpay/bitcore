import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Ledger from '../../src/ledger/wallet.js';

const ledger = new Ledger();
await ledger.connect();

const address = await ledger.getAddress({ chain: 'SOL' });

const tx = CWC.Transactions.create({
  network: 'livenet',
  chain: 'SOL',
  recipients: [{ address: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: 3896000000000000 }],
  from: address,
  blockHeight: 531_575,
  blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
  category: 'transfer'
});

console.log(`Sign ${tx}`);
const signedTransaction = await ledger.sign({
  chain: 'SOL',
  tx
});

console.log('Signed transaction');
console.log(signedTransaction);
process.exit(0);
