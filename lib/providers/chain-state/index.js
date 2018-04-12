const BTCStateProvider = require('./btc/btc');
const BCHStateProvider = require('./bch/bch');

const providers = {
  BTC: new BTCStateProvider(),
  BCH: new BCHStateProvider()
};


function ChainStateProvider() { }

ChainStateProvider.prototype.get = function (chain) {
  return providers[chain];
};

ChainStateProvider.prototype.streamAddressUtxos = function (chain, network, address, stream, args){
  return this.get(chain).streamAddressUtxos(network, address, stream, args);
};

ChainStateProvider.prototype.getBalanceForAddress = async function (chain, network, address){
  return this.get(chain).getBalanceForAddress(network, address);
};

ChainStateProvider.prototype.getBalanceForWallet = async function (chain, network, wallet) {
  return this.get(chain).getBalanceForWallet(wallet);
};

ChainStateProvider.prototype.getBlock = async function (chain, network, blockId) {
  return this.get(chain).getBlock(network, blockId);
};

ChainStateProvider.prototype.getBlocks = async function (chain, network, sinceBlock) {
  return this.get(chain).getBlocks(network, sinceBlock);
};

ChainStateProvider.prototype.streamTransactions = function (chain, network, stream, params) {
  return this.get(chain).streamTransactions(network, stream, params);
};

ChainStateProvider.prototype.streamTransaction = function (chain, network, txId, stream) {
  return this.get(chain).streamTransaction(network, txId, stream);
};

ChainStateProvider.prototype.createWallet = async function (chain, network, name, pubkey, params) {
  return this.get(chain).createWallet(network, name, pubkey, params);
};

ChainStateProvider.prototype.getWallet = async function (chain, network, walletId) {
  return this.get(chain).getWallet(network, walletId);
};

ChainStateProvider.prototype.streamWalletAddresses = function (chain, network, walletId, stream) {
  return this.get(chain).streamWalletAddresses(network, walletId, stream);
};

ChainStateProvider.prototype.updateWallet = async function (chain, network,  wallet, addresses) {
  return this.get(chain).updateWallet(network, wallet, addresses);
};

ChainStateProvider.prototype.streamWalletTransactions = function (chain, network, wallet, stream, args) {
  return this.get(chain).streamWalletTransactions(network, wallet, stream, args);
};

ChainStateProvider.prototype.getWalletBalance = async function (chain, network, walletId) {
  return this.get(chain).getWalletBalance(network, walletId);
};

ChainStateProvider.prototype.streamWalletUtxos = function (chain, network, walletId, stream, args) {
  return this.get(chain).streamWalletUtxos(network, walletId, stream, args);
};

ChainStateProvider.prototype.broadcastTransaction = async function (chain, network, rawTx) {
  return this.get(chain).broadcastTransaction(network, rawTx);
};

module.exports = new ChainStateProvider();
