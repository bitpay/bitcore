const testConfig = require('./bitcore-test.config.json');

testConfig.bitcoreNode.chains.BTC.regtest.trustedPeers[0].host = 'bitcoin';
testConfig.bitcoreNode.chains.BTC.regtest.rpc.host = 'bitcoin';

testConfig.bitcoreNode.chains.ETH.regtest.trustedPeers[0].host = 'geth';
testConfig.bitcoreNode.chains.ETH.regtest.trustedPeers[0].port = 30303;
testConfig.bitcoreNode.chains.ETH.regtest.providers[0].host = 'erigon';
testConfig.bitcoreNode.chains.ETH.regtest.providers[0].port = 8545;
testConfig.bitcoreNode.chains.ETH.regtest.providers[1].host = 'geth';
testConfig.bitcoreNode.chains.ETH.regtest.providers[1].port = 8546;

testConfig.bitcoreNode.chains.MATIC.regtest.trustedPeers[0].host = 'geth';
testConfig.bitcoreNode.chains.MATIC.regtest.trustedPeers[0].port = 30303;
testConfig.bitcoreNode.chains.MATIC.regtest.providers[0].host = 'geth';
testConfig.bitcoreNode.chains.MATIC.regtest.providers[0].port = 8546;

testConfig.bitcoreNode.chains.XRP.testnet.provider.host = 'rippled';
testConfig.bitcoreNode.chains.XRP.testnet.provider.port = 6006;
testConfig.bitcoreNode.chains.XRP.testnet.provider.dataHost = 'rippled';

module.exports = testConfig;
