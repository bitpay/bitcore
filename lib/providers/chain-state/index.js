const BTCStateProvider = require('./btc/btc');
const BCHStateProvider = require('./bch/bch');
const providers = {
  BTC: new BTCStateProvider(),
  BCH: new BCHStateProvider(),
  ETH: require('./eth/eth')
};


function ChainStateProvider() {

}

ChainStateProvider.prototype.get = (chain) => {
  return providers[chain];
};

ChainStateProvider.prototype.getAddressUtxos = async function (chain, network, address, stream, args){
  return this.get(chain).getAddressUtxos(network, address, stream, args);
};

ChainStateProvider.prototype.getBalanceForAddress = (chain, network, address) => {
  return this.get(chain).getBalanceForAddress(address);
};

ChainStateProvider.prototype.getBalanceForWallet = (chain,network,wallet) => {
  return this.get(chain).getBalanceForWallet(wallet);
};

ChainStateProvider.prototype.getBlock = (chain,  network,blockId) => {
  return this.get(chain).getBlock(blockId);
};

ChainStateProvider.prototype.getTransactions = (chain,network,params) => {
  return this.get(chain).getTransactions(params);
};

ChainStateProvider.prototype.getTransaction = (chain, network, txId) => {
  return this.get(chain).getTransaction(txId);
};

ChainStateProvider.prototype.createWallet = (chain,network,  params) => {
  return this.get(chain).createWallet(params);
};

ChainStateProvider.prototype.getWallet = (chain, network, walletId) => {
  return this.get(chain).getWallet(walletId);
};

ChainStateProvider.prototype.getWalletAddresses = (chain, network, walletId) => {
  return this.get(chain).getWalletAddresses(walletId);
};

ChainStateProvider.prototype.updateWallet = (chain, network,  walletId) => {
  return this.get(chain).updateWallet(walletId);
};

ChainStateProvider.prototype.getWalletTransactions = (chain, network, walletId) => {
  return this.get(chain).getWalletTransactions(walletId);
};

ChainStateProvider.prototype.getWalletBalance = (chain, network, walletId) => {
  return this.get(chain).getWalletBalance(walletId);
};

ChainStateProvider.prototype.getWalletUtxos = (chain, network, walletId) => {
  return this.get(chain).getWalletUtxos(walletId);
};

/*
 *ChainStateProvider.prototype.broadcastTransaction = (chain, network , tx) => {
 *  return this.get(chain).broadcastTransaction(tx);
 *};
 */

module.exports = new ChainStateProvider();
