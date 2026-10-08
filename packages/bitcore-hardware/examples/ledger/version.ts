import 'source-map-support/register.js';
import Ledger from '../../src/ledger/wallet.js';

const ledger = new Ledger();
await ledger.connect();

console.log('Awaiting approval from your ledger...');
console.log(await ledger.getVersion());
await ledger.disconnect();
process.exit(0);
