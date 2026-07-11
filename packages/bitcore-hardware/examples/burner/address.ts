import BitcoreHardware from '../../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

console.log('Tap burner wallet on an NFC reader to get the address...');
console.log(await wallet.getAddress({ index: 9 }));

console.log('Recieved address');
process.exit(0);
