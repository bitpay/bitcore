import Web3 from 'web3';
import EthereumTx from 'ethereumjs-tx';
import { Wallet } from 'src';

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
export class ETHTxProvider {
  lib = require('bitcore-lib');

  async create({ recipients, from, fee = 20000 }) {
    let txCount = await web3.eth.getTransactionCount(from);
    // construct the transaction data
    const { address, amount } = recipients[0];

    // EIP 155 chainId - mainnet: 1, ropsten: 3
    // let chainId = 1;
    // switch (network) {
    //   case 'mainnet':
    //     chainId = 1;
    //     break;
    //   case 'ropsten':
    //     chainId = 3;
    // }

    // !important amount needs to be passed into utils as a string
    const txData = {
      nonce: web3.utils.toHex(txCount),
      gasLimit: web3.utils.toHex(25000),
      gasPrice: web3.utils.toHex(fee), // 10 Gwei
      to: address,
      from,
      value: web3.utils.toHex(web3.utils.toWei(`${amount}`, 'wei'))
      // chainId
    };
    // const rawTx = new EthereumTx(txData).serialize().toString('hex');
    return txData;
  }

  async sign(params: { tx: string; wallet: Wallet; from: string }) {
    const { tx, wallet, from } = params;
    const rawTx = new EthereumTx(tx);
    const address = from.toLowerCase();
    try {
      const key = await wallet.storage.getKey({
        address,
        name: wallet.name,
        encryptionKey: wallet.unlocked.encryptionKey
      });

      console.log(key);
      // const privateKey =
      //   '2ac05b74db0570468f7684644a6b09c1e963b5a304989b0e14d213a8269cb409';
      const bufferKey = Buffer.from(key.privKey, 'hex');
      rawTx.sign(bufferKey);
      const serializedTx = rawTx.serialize();
      return serializedTx;
    } catch (err) {
      console.log(err);
    }
  }
}
