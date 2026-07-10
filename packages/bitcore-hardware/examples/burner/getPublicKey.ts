import BitcoreHardware from '../../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

console.log('Tap burner wallet on an NFC reader to output the public key');
console.log(await wallet.getPublicKey({ index: 1 }));

console.log('Signed transaction with Burner wallet, exiting...');
process.exit(0);
