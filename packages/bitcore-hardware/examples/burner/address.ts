import 'source-map-support/register.js';
import Burner from '../../src/burner.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!Burner.isValidChain(chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

const burner = new Burner();
burner.connect();

console.log('Tap an NFC reader with a burner wallet...');
console.log(await burner.getAddress({ chain, index: 9 }));
process.exit(0);
