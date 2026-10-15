import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Ledger from '../../src/ledger/wallet.js';
import Utils from '../../src/util.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!Ledger.isValidChain(chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

const ledger = new Ledger({ transport: 'speculos' });
await ledger.connect();

console.log('Awaiting approval from your ledger...');
switch (chain) {
  case 'SOL': {
    const address = await ledger.getAddress({ chain: 'SOL' });
    
    const tx = CWC.Transactions.create({
      network: 'livenet',
      chain: 'SOL',
      recipients: [{ address: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: 3896000000000000 }],
      from: address,
      blockHeight: 531_575,
      blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
      category: 'transfer'
    });
    
    const signedTransaction = await ledger.sign({
      chain: 'SOL',
      tx
    });
    console.log(signedTransaction);
    break;
  }
  case 'ETH': {
    const tx = CWC.Transactions.create({
      chain: 'ETH',
      recipients: [{ address: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 3896000000000000 }],
      nonce: 0,
      gasPrice: 21000,
      data: '0x'
    });
    
    const signedTransaction = await ledger.sign({
      chain: 'ETH',
      tx
    });
    console.log(signedTransaction);
    break;
  }
  // BCH, DOGE, and LTC all need the previous transactions of all the inputs in order to sign
  case 'LTC': {
    const lib = Utils.libs[chain];
    const ledgerAddress = await ledger.getAddress({ chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();
    
    const fundingTx = new lib.Transaction(
      '0200000001' +
      '1111111111111111111111111111111111111111111111111111111111111111' + // fake prevout hash
      '00000000' + // prevout index
      '00' +       // empty scriptSig
      'ffffffff' + // sequence
      '01' +
      'a086010000000000' + // 100000 litoshis
      '1976a914b1d140085b7ea3f5ebc46d49dabed8cb78e7c42488ac' +
      '00000000'  // locktime
    );

    const fee = 1000;
    const value = 100_000;
    
    const utxos = [
      {
        chain: 'LTC',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: fundingTx.id,
        mintHeight: -1,
        spentHeight: -2,
        address: ledgerAddress,
        script: lib.Script.fromAddress(ledgerAddress).toString(),
        value: value,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'LTC',
      recipients: [{ address: receivingAddress, amount: value - fee }],
      utxos,
      fee
    });

    const signedTransaction = await ledger.sign({
      chain: 'LTC',
      tx,
      utxos,
      prevTxs: [fundingTx.toString()]
    });

    console.log(signedTransaction);
    break;
  }
  case 'DOGE': {
    const lib = Utils.libs[chain];
    const ledgerAddress = await ledger.getAddress({ chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();

    const fundingTx = new lib.Transaction(
      '0200000001' +
      '1111111111111111111111111111111111111111111111111111111111111111' + // fake prevout hash
      '00000000' + // prevout index
      '00' +       // empty scriptSig
      'ffffffff' + // sequence
      '01' +
      '00e1f50500000000' + // 100000000 koinus (1 DOGE)
      '1976a9147a9b588e995d3134c13672b6ad09a74b2aa7e94988ac' +
      '00000000'  // locktime
    );

    const value = 100000000;
    const fee = 1000000;

    const utxos = [
      {
        chain: 'DOGE',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: fundingTx.id,
        mintHeight: -1,
        spentHeight: -2,
        address: ledgerAddress,
        script: lib.Script.fromAddress(ledgerAddress).toString(),
        value: value,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'DOGE',
      recipients: [{ address: receivingAddress, amount: value - fee }],
      utxos,
      fee
    });

    const signedTransaction = await ledger.sign({
      chain: 'DOGE',
      tx,
      utxos,
      prevTxs: [fundingTx.toString()]
    });

    console.log(signedTransaction);
    break;
  }
  case 'BCH': {
    const lib = Utils.libs[chain];
    const ledgerAddress = await ledger.getAddress({ chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();
      
    const fundingTx = new lib.Transaction(
      '0200000001' +
      '1111111111111111111111111111111111111111111111111111111111111111' + // fake prevout hash
      '00000000' + // prevout index
      '00' +       // empty scriptSig
      'ffffffff' + // sequence
      '01' +
      'a086010000000000' + // 100000 sats
      '1976a91447b2653a6a64fadd4118cab92e1c226b96c4158188ac' +
      '00000000'  // locktime
    );


    const fee = 362;
    const value = 100_000;
    const utxos = [
      {
        chain: 'BCH',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: fundingTx.id,
        mintHeight: -1,
        spentHeight: -2,
        address: ledgerAddress,
        script: lib.Script.fromAddress(ledgerAddress).toString(),
        value: value,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'BCH',
      recipients: [{ address: receivingAddress, amount: value - fee }],
      utxos,
      fee
    });

    const signedTransaction = await ledger.sign({
      chain: 'BCH',
      tx,
      utxos,
      prevTxs: [fundingTx.toString()]
    });

    console.log(signedTransaction);
    break;
  }
  default:
  case 'BTC': {
    const lib = Utils.libs[chain];
    const ledgerAddress = await ledger.getAddress({ chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();

    const utxos = [
      {
        chain: 'BTC',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: '78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4',
        mintHeight: 957071,
        spentHeight: -2,
        address: ledgerAddress,
        script: lib.Script.fromAddress(ledgerAddress).toString(),
        value: 1562,
        confirmations: -1
      }
    ];
    
    const tx: string = CWC.Transactions.create({
      chain: 'BTC',
      recipients: [{ address: receivingAddress, amount: 1200 }],
      utxos
    });
    
    const signedTransaction = await ledger.sign({
      chain: 'BTC',
      tx,
      utxos
    });
    
    console.log(signedTransaction);
    break;
  }
}

await ledger.disconnect();
process.exit(0);
