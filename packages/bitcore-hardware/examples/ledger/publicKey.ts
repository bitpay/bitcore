import 'source-map-support/register.js';
import { HwProxy } from '../../src/index.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';
const connection: 'usb' | 'speculos' = args[1]?.toLowerCase() === 'usb' ? 'usb' : 'speculos';

if (!HwProxy.isValidChain('ledger', chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

await HwProxy.connect();

console.log('Waiting for response...');
console.log(await HwProxy.getPublicKey({ vendor: 'ledger', connection, chain }));
await HwProxy.disconnect();
process.exit(0);
