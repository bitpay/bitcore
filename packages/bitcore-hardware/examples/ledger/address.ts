import 'source-map-support/register.js';
import { HwProxy } from '../../src/index.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!HwProxy.isValidChain('ledger', chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

await HwProxy.connect();

console.log('Awaiting approval from your ledger...');
console.log(await HwProxy.getAddress({ vendor: 'ledger', connection: 'speculos', chain }));
await HwProxy.disconnect();
process.exit(0);
