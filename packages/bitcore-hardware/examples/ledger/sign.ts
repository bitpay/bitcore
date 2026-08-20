import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Ledger from '../../src/ledger/wallet.js';

const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!Ledger.isValidChain(chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

const ledger = new Ledger();
await ledger.connect();

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
    
    console.log(`Sign ${tx}`);
    const signedTransaction = await ledger.sign({
      chain: 'SOL',
      tx
    });
    
    console.log('Signed transaction');
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
    
    console.log(`Sign ${tx}`);
    const signedTransaction = await ledger.sign({
      chain: 'ETH',
      tx
    });
    
    console.log('Signed transaction');
    console.log(signedTransaction);
    break;
  }
  default:
  case 'BTC': {
    // utxos from https://api.bitcore.io/api/BTC/mainnet/address/bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq/coins
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
        address: 'bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq',
        script: '001491f570a0236f1b6b40f52514c6e6623eacd56a0b',
        value: 1562,
        confirmations: -1
      }
    ];
    
    const tx: string = CWC.Transactions.create({
      chain: 'BTC',
      recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: 1200 }],
      utxos
    });
    
    console.log(`Sign ${tx}`);
    const signedTransaction = await ledger.sign({
      chain: 'BTC',
      tx,
      utxos
    });
    
    console.log('Signed transaction');
    console.log(signedTransaction);
    /* 
    Broadcasted using bitcore-node
    $ curl --header "Content-Type: application/json" --request POST -d '{"rawTx": "02000000000101b405040dc80bbd0d0c0e5d36e89c90c3879dd0044aa62e0cdcdf2713199a51780000000000ffffffff01b004000000000000160014dd3b3ea310eb69632adc047ec7ca82e9ac61f9790247304402205e0bc606e3e76e8c623b4de8fd1c1ac098aaf32b161310f7dbaa14d8d29dcd2602203fd47d3d1fb0b223b203a5d01fd28804296666d1a15d1040d4140ba4bfee6125012103a7c7057355969fb52b23744aae7275f10440620654a912a78684a8a697d92e2b00000000"}' https://api.bitcore.io/api/BTC/mainnet/tx/send
    {"txid":"3049a6c75390696260366672693ebccf1a5a9892e3aa728b1f51c59e8f137a26"}
    
    View on Insight: https://bitpay.com/insight/BTC/mainnet/tx/3049a6c75390696260366672693ebccf1a5a9892e3aa728b1f51c59e8f137a26
    */
    break;
  }
}

await ledger.disconnect();
process.exit(0);
