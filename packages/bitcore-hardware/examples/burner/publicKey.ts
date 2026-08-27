import 'source-map-support/register.js';
import Burner from '../../src/burner.js';

const burner = new Burner();
burner.connect();

console.log('Tap an NFC reader with a burner wallet...');
console.log(await burner.getPublicKey({ index: 9 }));
process.exit(0);
