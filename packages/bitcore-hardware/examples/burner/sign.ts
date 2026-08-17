import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const { PublicKey, Script } = CWC.BitcoreLib;

const burner = new Burner();
burner.connect();

// Predefined for now. For other wallets:
// const publicKey = new PublicKey(await burner.getPublicKey({ index: 9 }))
const publicKey = new PublicKey('04161f62f9778a44bd3d07009b1f2e9df7ab1dc57e74665db7ed8baa95780452ab39f4975099f3ae36f7b6a874b46edd79d1d88573a325b9976fd8f120bed704aa');
const address = publicKey.toAddress();

const utxos = [
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: true,
    mintIndex: 0,
    spentTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
    mintTxid: 'd3667993af738c3db4033dc462ab95f9916da455c628bbf71488484e2b6803c3',
    mintHeight: 5,
    spentHeight: 111,
    address: address.toString(),
    script: Script.buildWitnessV0Out(address),
    value: 600,
    confirmations: 1,
    sequenceNumber: 4294967293,
    wallets: []
  },
  {
    chain: 'BTC',
    network: 'regtest',
    coinbase: false,
    mintIndex: 1,
    spentTxid: '',
    mintTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
    mintHeight: 111,
    spentHeight: -2,
    address: address.toString(),
    script: Script.buildWitnessV0Out(address),
    value: 600,
    confirmations: 1,
    sequenceNumber: 4294967295,
    wallets: []
  }
];

const tx = CWC.Transactions.create({
  chain: 'BTC',
  recipients: [{ address: '1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', amount: 1000 }],
  utxos
});

console.log('Tap burner wallet on an NFC reader to sign a transaction');
const signedTransaction: any = await burner.sign({
  chain: 'BTC',
  tx,
  utxos,
  index: 9,
  password: '123456'
});

console.log('Signed transaction');
console.log(signedTransaction);

process.exit(0);
