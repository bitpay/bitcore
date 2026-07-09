import BitcoreHardware from '../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

console.log('Tap burner wallet on NFC reader to generate a key');
console.log(await wallet.genKey({ index: 3, entropy: '3c825af7d2e1b02b6a00b257ebe883260b4aa6302c9878d412046d10141b261d' }));

console.log('Generated a key with Burner wallet, exiting...');
process.exit(0);
