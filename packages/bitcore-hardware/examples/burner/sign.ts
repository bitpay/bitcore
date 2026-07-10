import BitcoreHardware from '../../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

console.log('Tap burner wallet on ahn NFC reader to sign and output a message');
console.log(await wallet.sign({ index: 1, message: '010503' }));

console.log('Signed message with Burner wallet, exiting...');
process.exit(0);
