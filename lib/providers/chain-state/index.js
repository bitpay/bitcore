const BTCStateProvider = require('./btc/btc');
const BCHStateProvider = require('./bch/bch');

const providers = {
  BTC: new BTCStateProvider(),
  BCH: new BCHStateProvider(),
  ETH: require('./eth/eth')
};


function ChainStateProvider() {

}

ChainStateProvider.prototype.get = function (chain) {
  return providers[chain];
};

ChainStateProvider.prototype.getAddressUtxos = async function (chain, network, address, stream, args){
  return this.get(chain).getAddressUtxos(network, address, stream, args);
};

ChainStateProvider.prototype.getBalanceForAddress = async function (chain, network, address){
  return this.get(chain).getBalanceForAddress(network, address);
};

ChainStateProvider.prototype.getBalanceForWallet = async function (chain,network,wallet) {
  return this.get(chain).getBalanceForWallet(wallet);
};

ChainStateProvider.prototype.getBlock = async function (chain,  network,blockId) {
  return this.get(chain).getBlock(blockId);
};

ChainStateProvider.prototype.getTransactions = async function (chain,network,params) {
  return this.get(chain).getTransactions(params);
};

ChainStateProvider.prototype.getTransaction = async function (chain, network, txId) {
  return this.get(chain).getTransaction(txId);
};

ChainStateProvider.prototype.createWallet = async function (chain,network,  params) {
  return this.get(chain).createWallet(params);
};

ChainStateProvider.prototype.getWallet = async function (chain, network, walletId) {
  return this.get(chain).getWallet(network, walletId);
};

ChainStateProvider.prototype.getWalletAddresses = async function (chain, network, walletId, stream) {
  return this.get(chain).getWalletAddresses(network, walletId, stream);
};

ChainStateProvider.prototype.updateWallet = async function (chain, network,  walletId) {
  return this.get(chain).updateWallet(walletId);
};

ChainStateProvider.prototype.getWalletTransactions = async function (chain, network, walletId, stream, args) {
  return this.get(chain).getWalletTransactions(network, walletId, stream, args);
};

ChainStateProvider.prototype.getWalletBalance = async function (chain, network, walletId) {
  return this.get(chain).getWalletBalance(walletId);
};

ChainStateProvider.prototype.getWalletUtxos = async function (chain, network, walletId) {
  return this.get(chain).getWalletUtxos(walletId);
};

/*
 *ChainStateProvider.prototype.broadcastTransaction = async function (chain, network , tx) {
 *  return this.get(chain).broadcastTransaction(tx);
 *};
 */

module.exports = new ChainStateProvider();
