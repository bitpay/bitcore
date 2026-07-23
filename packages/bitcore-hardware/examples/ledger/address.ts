import Ledger from '../../src/ledger.js';

const ledger = new Ledger();
await ledger.connect();
console.log(await ledger.getAddress({ index: 0 }));
await ledger.disconnect();
process.exit(0);
