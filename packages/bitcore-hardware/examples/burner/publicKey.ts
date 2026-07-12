import Burner from '../../src/burner.js';

const burner = new Burner('btc');
burner.connect();

console.log('Tap burner wallet on an NFC reader to output the public key...');
console.log(await burner.getPublicKey({ index: 9 }));

console.log('Recieved public key');
process.exit(0);
