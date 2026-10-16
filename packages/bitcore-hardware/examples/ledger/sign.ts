import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import { HwProxy } from '../../src/index.js';
import Utils from '../../src/util.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!HwProxy.isValidChain('ledger', chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

await HwProxy.connect();

console.log('Awaiting approval from your ledger...');
switch (chain) {
  case 'SOL': {
    const address = await HwProxy.getAddress({ wallet: 'ledger', transport: 'speculos', chain: 'SOL' });
    
    const tx = CWC.Transactions.create({
      network: 'livenet',
      chain: 'SOL',
      recipients: [{ address: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: 3896000000000000 }],
      from: address,
      blockHeight: 531_575,
      blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
      category: 'transfer'
    });
    
    const signedTransaction = await HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
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
    
    const signedTransaction = await HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'ETH',
      tx
    });
    console.log(signedTransaction);
    break;
  }
  // BCH, DOGE, and LTC all need the previous transactions of all the inputs in order to sign
  case 'LTC': {
    const lib = Utils.libs[chain];
    const ledgerAddress = await HwProxy.getAddress({ wallet: 'ledger', transport: 'speculos', chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();

    const fee = 1000;
    const satoshis = 100_000;
    const fundingTx = new lib.Transaction()
      .addInput(
        new lib.Transaction.Input({
          outputIndex: 0,
          script: '',
          prevTxId: '1111111111111111111111111111111111111111111111111111111111111111',
          output: new lib.Transaction.Output({
            script: '',
            satoshis
          })
        })
      )
      .addOutput(
        new lib.Transaction.Output({
          satoshis,
          script: new lib.Script.buildPublicKeyHashOut(ledgerAddress)
        })
      );

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
        value: satoshis,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'LTC',
      recipients: [{ address: receivingAddress, amount: satoshis - fee }],
      utxos,
      fee
    });

    const signedTransaction = await HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
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
    const ledgerAddress = await HwProxy.getAddress({ wallet: 'ledger', transport: 'speculos', chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();

    const fee = 1_000_000;
    const satoshis = 100_000_000;
    const fundingTx = new lib.Transaction()
      .addInput(
        new lib.Transaction.Input({
          outputIndex: 0,
          script: '',
          prevTxId: '1111111111111111111111111111111111111111111111111111111111111111',
          output: new lib.Transaction.Output({
            script: '',
            satoshis
          })
        })
      )
      .addOutput(
        new lib.Transaction.Output({
          satoshis,
          script: new lib.Script.buildPublicKeyHashOut(ledgerAddress)
        })
      );

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
        value: satoshis,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'DOGE',
      recipients: [{ address: receivingAddress, amount: satoshis - fee }],
      utxos,
      fee
    });

    const signedTransaction = await HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
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
    const ledgerAddress = await HwProxy.getAddress({ wallet: 'ledger', transport: 'speculos', chain });
    const receivingAddress = new lib.PrivateKey().toAddress().toString();
      
    const fee = 362;
    const satoshis = 100_000;
    const fundingTx = new lib.Transaction()
      .addInput(
        new lib.Transaction.Input({
          outputIndex: 0,
          script: '',
          prevTxId: '1111111111111111111111111111111111111111111111111111111111111111',
          output: new lib.Transaction.Output({
            script: '',
            satoshis
          })
        })
      )
      .addOutput(
        new lib.Transaction.Output({
          satoshis,
          script: new lib.Script.buildPublicKeyHashOut(ledgerAddress)
        })
      );


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
        value: satoshis,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'BCH',
      recipients: [{ address: receivingAddress, amount: satoshis - fee }],
      utxos,
      fee
    });

    const signedTransaction = await HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
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
    const ledgerAddress = await HwProxy.getAddress({ wallet: 'ledger', transport: 'speculos', chain });
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
    
    const signedTransaction = await HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'BTC',
      tx,
      utxos
    });
    
    console.log(signedTransaction);
    break;
  }
}

await HwProxy.disconnect();
process.exit(0);
