import 'source-map-support/register.js';
import { HwProxy } from '../../src/index.js';

await HwProxy.connect();

console.log('Tap an NFC reader with a burner wallet...');
console.log(await HwProxy.getPublicKey({ wallet: 'burner', transport: 'nfc' }));
process.exit(0);
