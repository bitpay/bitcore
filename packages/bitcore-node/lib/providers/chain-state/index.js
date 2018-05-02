const BTCStateProvider = require('./btc/btc');
const BCHStateProvider = require('./bch/bch');

const providers = {
  BTC: new BTCStateProvider(),
  BCH: new BCHStateProvider()
};

class ChainStateProvider {

  get(chain) {
    return providers[chain];
  }

  streamAddressUtxos(chain, network, address, stream, args) {
    return this.get(chain).streamAddressUtxos(network, address, stream, args);
  }

  async getBalanceForAddress(chain, network, address) {
    return this.get(chain).getBalanceForAddress(network, address);
  }

  async getBalanceForWallet(chain, network, wallet) {
    return this.get(chain).getBalanceForWallet(wallet);
  }

  async getBlock(chain, network, blockId) {
    return this.get(chain).getBlock(network, blockId);
  }

  async getBlocks(chain, network, sinceBlock) {
    return this.get(chain).getBlocks(network, sinceBlock);
  }

  streamTransactions(chain, network, stream, params) {
    return this.get(chain).streamTransactions(network, stream, params);
  }

  streamTransaction(chain, network, txId, stream) {
    return this.get(chain).streamTransaction(network, txId, stream);
  }

  async createWallet(params) {
    return this.get(params.chain).createWallet(params);
  }

  async getWallet(params) {
    return this.get(params.chain).getWallet(params);
  }

  streamWalletAddresses(chain, network, walletId, stream) {
    return this.get(chain).streamWalletAddresses(network, walletId, stream);
  }

  async updateWallet(params) {
    return this.get(params.chain).updateWallet(params);
  }

  streamWalletTransactions(chain, network, wallet, stream, args) {
    return this.get(chain).streamWalletTransactions(
      network,
      wallet,
      stream,
      args
    );
  }

  async getWalletBalance(params) {
    return this.get(params.chain).getWalletBalance(params);
  }

  streamWalletUtxos(params) {
    return this.get(params.chain).streamWalletUtxos(params);
  }

  async broadcastTransaction(chain, network, rawTx) {
    return this.get(chain).broadcastTransaction(network, rawTx);
  }
}

module.exports = new ChainStateProvider();
