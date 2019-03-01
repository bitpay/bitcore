import Web3 from 'web3';
import EthereumTx from 'ethereumjs-tx';
import { Wallet } from 'src';

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
export class ETHTxProvider {
  lib = require('bitcore-lib');

  async create({ recipients, from, fee = 20000 }) {
    let txCount = await web3.eth.getTransactionCount(from);
    const { address, amount } = recipients[0];

    // !Important: Amount needs to be passed into utils as a string
    const txData = {
      nonce: web3.utils.toHex(txCount),
      gasLimit: web3.utils.toHex(25000),
      gasPrice: web3.utils.toHex(fee),
      to: address,
      from,
      value: web3.utils.toHex(web3.utils.toWei(`${amount}`, 'wei'))
    };
    const rawTx = new EthereumTx(txData).serialize().toString('hex');
    return rawTx;
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
      const bufferKey = Buffer.from(key.privKey, 'hex');
      rawTx.sign(bufferKey);
      const serializedTx = rawTx.serialize();
      return '0x' + serializedTx.toString('hex');
    } catch (err) {
      console.log(err);
    }
  }
}
