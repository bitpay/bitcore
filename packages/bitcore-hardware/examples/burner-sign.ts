import BitcoreHardware from '../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

console.log('Tap burner wallet on NFC reader to sign and output transaction');
console.log(await wallet.sign({ amount: 0.00001 }));

console.log('Singed transaction with Burner wallet, exiting...');
process.exit(0);
