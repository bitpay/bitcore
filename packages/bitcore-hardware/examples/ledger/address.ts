import Ledger from '../../src/ledger.js';

const ledger = new Ledger();
await ledger.connect();
console.log(await ledger.getAddress());
await ledger.disconnect();
process.exit(0);
