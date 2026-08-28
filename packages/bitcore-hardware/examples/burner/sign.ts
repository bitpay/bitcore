import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';


const args = process.argv.slice(2);
const chain = args[0]?.toUpperCase() || 'BTC';

if (!Burner.isValidChain(chain)) {
  throw new Error(`Invalid chain: ${chain}`);
}

const burner = new Burner();
burner.connect();

switch (chain) {
  case 'ETH': {
    const tx: string = CWC.Transactions.create({
      chain: 'ETH',
      recipients: [{ address: '0x6Cc9397c3B38739daCbfaA68EaD5F5D77Ba5F455', amount: 0.2 * 1e18 }],
      nonce: 0,
      chainId: 11155111,
      gasPrice: 1000000008,
      gasLimit: 71994,
      data: '0x'
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
    /*
    Broadcasted using bitcore-node:
    $ curl -X POST https://ethereum-sepolia.publicnode.com   -H "Content-Type: application/json"   -d '{
        "jsonrpc": "2.0",
        "method": "eth_sendRawTransaction",
        "params": [ "0xf87080843b9aca088301193a946cc9397c3b38739dacbfaa68ead5f5d77ba5f4558802c68af0bb140000808401546d71a04f6cd346b67ac2ea8c1fc9de5bc9f510b784af65579f524481862aaf781dcb61a00518ff3a702e8fff1212c76bef6c0e769bd0823b365b8c5bac27bd451d05bc62" ],
        "id": 1
      }'
    {"jsonrpc":"2.0","id":1,"result":"0xc69f8b31b4de4fe7de346ba198e270bf896b89cb87da6e94e93f9881ce65d6c8"}
    
    View on Insight: https://bitpay.com/insight/ETH/sepolia/tx/0xc69f8b31b4de4fe7de346ba198e270bf896b89cb87da6e94e93f9881ce65d6c8
    */
    break;
  }
  default:
  case 'BTC': {
    // utxo from https://api.bitcore.io/api/BTC/mainnet/address/bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk/coins
    const utxos = [
      {
        chain: 'BTC',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: '3f91933d95a2025e10f6a3c4d332c693921550036b1c2e9c2625189b4f49d6e4',
        mintHeight: 956531,
        spentHeight: -2,
        address: 'bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk',
        script: '001456c5557b413096aa9ce65ef7f2e6133df73bca8b',
        value: 8050,
        confirmations: -1
      }
    ];
    
    const tx: string = CWC.Transactions.create({
      chain: 'BTC',
      recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: 7800 }],
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
    /*
    Broadcasted using bitcore-node:
    $ curl --header "Content-Type: application/json" --request POST -d '{"rawTx":"02000000000101e4d6494f9b1825269c2e1c6b0350159293c632d3c4a3f6105e02a2953d93913f0000000000ffffffff01781e000000000000160014dd3b3ea310eb69632adc047ec7ca82e9ac61f97902483045022100ea2a45801e44f57dfc55f40f38d13122fb14d654ac54ac45ff8619420a15803a0220724ffad2f689561961a1d3e5d6b87998f461d8f891a66f5043bfe7b99ce6c2db012102161f62f9778a44bd3d07009b1f2e9df7ab1dc57e74665db7ed8baa95780452ab00000000"}' https://api.bitcore.io/api/BTC/mainnet/tx/send
    {"txid":"13468b95f83bd346ddd96fafa145d078da9265529829c7fa43324cfba557b243"}
    
    View on Insight: https://bitpay.com/insight/BTC/mainnet/tx/13468b95f83bd346ddd96fafa145d078da9265529829c7fa43324cfba557b243
    */
    break;
  }
}

process.exit(0);
