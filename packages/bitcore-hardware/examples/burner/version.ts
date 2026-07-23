import Burner from '../../src/burner.js';

const burner = new Burner('btc');
burner.connect();

console.log('Tap burner wallet on an NFC reader to get the firmware version...');
console.log(await burner.getVersion({ index: 1 }));

console.log('Recieved version');
process.exit(0);
