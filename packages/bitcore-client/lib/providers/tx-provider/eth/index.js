const Transaction = require('ethereumjs-tx');
const Web3 = require('web3-eth');
const config = require('bitcore-node/lib/config');

class ETHTxProvder {
  constructor(chain) {
    this.chain = chain || 'ETH';
    this.chain = this.chain.toUpperCase();
    this.config = config.chains[this.chain];
  }
  web3For(network) {
    const networkConfig = this.config[network];
    const provider = networkConfig.provider;
    const portString = provider.port ? `:${provider.port}` : '';
    const connUrl = `${provider.protocool}://${provider.host}${portString}`;
    let ProviderType;
    switch (provider.protocool) {
      case 'wss':
        ProviderType = Web3.providers.WebsocketProvider;
        break;
      default:
        ProviderType = Web3.providers.HttpProvider;
        break;
    }
    return new Web3(new ProviderType(connUrl));
  }

  async create({ network, addresses, amount }) {
    var nonce = await this.web3For(network).eth.getTransactionCountAsync(
      addresses
    );
    var tx = new Transaction({
      to: addresses,
      value: amount,
      nonce: nonce,
      gasLimit: 2000000
    });
    return tx;
  }


  sign({ tx, keys, utxos }) {
/*
 *    let bitcoreTx = new bitcoreLib.Transaction(tx);
 *    let applicableUtxos = this.getRelatedUtxos({
 *      outputs: bitcoreTx.inputs,
 *      utxos
 *    });
 *
 *    let newTx = new bitcoreLib.Transaction()
 *      .from(applicableUtxos)
 *      .to(this.getOutputsFromTx({ tx: bitcoreTx }));
 *    return newTx.sign(keys.toString('hex'));
 */
  }

  getRelatedUtxos({ outputs, utxos }) {
    /*
     *let txids = outputs.map(output => output.toObject().prevTxId);
     *let applicableUtxos = utxos.filter(utxo => txids.includes(utxo.txid));
     *return applicableUtxos;
     */
  }

  getOutputsFromTx({ tx }) {
    /*
     *return tx.outputs.map(({ script, satoshis }) => {
     *  let address = script;
     *  return { address, satoshis };
     *});
     */
  }

  getSigningAddresses({ tx, utxos }) {
    /*
     *let bitcoreTx = new bitcoreLib.Transaction(tx);
     *let applicableUtxos = this.getRelatedUtxos({
     *  outputs: bitcoreTx.inputs,
     *  utxos
     *});
     *return applicableUtxos.map(utxo => utxo.address);
     */
  }

}
module.exports = new ETHTxProvder;
