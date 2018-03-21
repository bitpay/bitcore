const providers = {
  BTC: require('./btc'),
  BCH: require('./bch'),
  ETH: require('./eth')
};


function ChainStateProvider() {
  
}

ChainStateProvider.prototype.get = (chain) => {
  return providers[chain];
};

ChainStateProvider.prototype.getBalanceForAddress = (chain, address) => {
  return this.get(chain).getBalanceForAddress(address);
};

ChainStateProvider.prototype.getBalanceForWallet = (chain, wallet) => {
  return this.get(chain).getBalanceForWallet(wallet);
};

ChainStateProvider.prototype.getBlock = (chain, blockId) => {
  return this.get(chain).getBlock(blockId);
};

ChainStateProvider.prototype.getTransactions = (chain, params) => {
  return this.get(chain).getTransactions(params);
};

ChainStateProvider.prototype.getTransaction = (chain, txId) => {
  return this.get(chain).getTransaction(txId);
};

ChainStateProvider.prototype.createWallet = (chain, params) => {
  return this.get(chain).createWallet(params);
};

ChainStateProvider.prototype.getWallet = (chain, walletId) => {
  return this.get(chain).getWallet(walletId);
};

ChainStateProvider.prototype.getWalletAddresses = (chain, walletId) => {
  return this.get(chain).getWalletAddresses(walletId);
};

ChainStateProvider.prototype.updateWallet = (chain, walletId) => {
  return this.get(chain).updateWallet(walletId);
};

ChainStateProvider.prototype.getWalletTransactions = (chain, walletId) => {
  return this.get(chain).getWalletTransactions(walletId);
};

ChainStateProvider.prototype.getWalletBalance = (chain, walletId) => {
  return this.get(chain).getWalletBalance(walletId);
};

ChainStateProvider.prototype.getWalletUtxos = (chain, walletId) => {
  return this.get(chain).getWalletUtxos(walletId);
};

ChainStateProvider.prototype.broadcastTransaction = (chain, tx) => {
  return this.get(chain).broadcastTransaction(tx);
};

module.exports = new ChainStateProvider();
