import 'source-map-support/register.js';
import Burner from '../../src/burner.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!Burner.isValidChain(chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

const burner = new Burner();
burner.connect();

console.log('Tap burner wallet on an NFC reader to get the address...');
console.log(await burner.getAddress({ chain, index: 9 }));

console.log('Recieved address');
process.exit(0);
