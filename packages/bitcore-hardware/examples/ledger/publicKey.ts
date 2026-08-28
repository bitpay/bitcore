import 'source-map-support/register.js';
import Ledger from '../../src/ledger/wallet.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!Ledger.isValidChain(chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

const ledger = new Ledger();
await ledger.connect();
console.log(await ledger.getPublicKey({ chain }));
await ledger.disconnect();
process.exit(0);
