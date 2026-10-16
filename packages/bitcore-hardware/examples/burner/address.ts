import 'source-map-support/register.js';
import { HwProxy } from '../../src/index.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!HwProxy.isValidChain('burner', chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

await HwProxy.connect();

console.log('Tap an NFC reader with a burner wallet...');
console.log(await HwProxy.getAddress({ wallet: 'burner', transport: 'nfc', chain }));
process.exit(0);
