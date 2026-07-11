import BitcoreHardware from '../../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

console.log('Tap burner wallet on an NFC reader to get the firmware version...');
console.log(await wallet.getVersion({ index: 1 }));

console.log('Recieved version');
process.exit(0);
