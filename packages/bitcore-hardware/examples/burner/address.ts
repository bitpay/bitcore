import Burner from '../../src/burner.js';

const burner = new Burner('btc');
burner.connect();

console.log('Tap burner wallet on an NFC reader to get the address...');
console.log(await burner.getAddress({ index: 9 }));

console.log('Recieved address');
process.exit(0);
