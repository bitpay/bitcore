import 'source-map-support/register.js';
import { HwProxy } from '../../src/index.js';

await HwProxy.connect();

console.log('Tap an NFC reader with a burner device...');
console.log(await HwProxy.getPublicKey({ vendor: 'burner', connection: 'nfc' }));
process.exit(0);
