import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const burner = new Burner();
burner.connect();

const tx: string = CWC.Transactions.create({
  chain: 'ETH',
  recipients: [{ address: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 3896000000000000 }],
  nonce: 0,
  gasPrice: 20000000000,
  data: '0xb6b4af05000000000000000000000000000000000000000000000000000dd764300b800000000000000000000000000000000000000000000000000000000004a817c8000000000000000000000000000000000000000000000000000000016ada606a26050bb49a5a8228599e0dd48c1368abd36f4f14d2b74a015b2d168dbcab0773ce399393220df874bb22ca961f351e038acd2ba5cc8c764385c9f23707622cc435000000000000000000000000000000000000000000000000000000000000001c7e247d684a635813267b10a63f7f3ba88b28ca2790c909110b28236cf1b9bba03451e83d5834189f28d4c77802fc76b7c760a42bc8bebf8dd15e6ead146805630000000000000000000000000000000000000000000000000000000000000000'
});

console.log('Tap burner wallet on an NFC reader to sign a transaction');
const signedTransaction = await burner.sign({
  chain: 'ETH',
  tx,
  password: '123456',
  index: 9
});

console.log('Signed transaction');
console.log(signedTransaction);

process.exit(0);
