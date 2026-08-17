import 'source-map-support/register.js';
import Ledger from '../../src/ledger/wallet.js';

const args = process.argv.slice(2);
const chain = args[0] || 'BTC';

const ledger = new Ledger();
await ledger.connect();
console.log(await ledger.getAddress({ chain }));
await ledger.disconnect();
process.exit(0);
