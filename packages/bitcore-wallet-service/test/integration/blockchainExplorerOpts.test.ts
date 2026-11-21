'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import sinon from 'sinon';
import { WalletService } from '../../src/lib/server';
import helpers from './helpers';

const should = chai.should();

describe('WalletService#_getBlockchainExplorer', function() {
  let server: WalletService;

  before(async function() {
    await helpers.before();
  });

  beforeEach(async function() {
    await helpers.beforeEach();
    server = new WalletService();
    // helpers.before() installs a mock explorer for every server; these tests exercise the real lookup
    server.blockchainExplorer = undefined;
  });

  afterEach(function() {
    sinon.restore();
  });

  after(async function() {
    await helpers.after();
  });

  it('should return the configured explorer instance when there is one', function() {
    const explorer = helpers.getBlockchainExplorer();
    server.blockchainExplorer = explorer;
    server._getBlockchainExplorer('btc', 'livenet').should.equal(explorer);
  });

  it('should use the url configured for the chain and network', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('btc', 'livenet').baseUrl.should.equal('http://localhost:1234/api/BTC/mainnet');
  });

  it('should match the chain case-insensitively', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('BTC', 'livenet').baseUrl.should.equal('http://localhost:1234/api/BTC/mainnet');
  });

  it('should use the provider configured for the chain and network', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234', provider: 'dummy' } } };
    const logw = sinon.spy(server, 'logw');
    should.not.exist(server._getBlockchainExplorer('btc', 'livenet'));
    logw.calledOnce.should.equal(true);
    logw.firstCall.args[0].should.equal('Could not instantiate blockchain explorer:');
    logw.firstCall.args[1].message.should.equal('Provider not supported: dummy');
  });

  it('should fall back to options configured for the network alone, without their provider', function() {
    server.blockchainExplorerOpts = { livenet: { url: 'http://localhost:4321', provider: 'dummy' } };
    server._getBlockchainExplorer('btc', 'livenet').baseUrl.should.equal('http://localhost:4321/api/BTC/mainnet');
  });

  it('should use the default url when nothing is configured for the chain and network', function() {
    server.blockchainExplorerOpts = { btc: { livenet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('eth', 'sepolia').baseUrl.should.equal('https://api-eth.bitcore.io/api/ETH/sepolia');
    server.blockchainExplorerOpts = undefined;
    server._getBlockchainExplorer('eth', 'sepolia').baseUrl.should.equal('https://api-eth.bitcore.io/api/ETH/sepolia');
  });

  it('should look up the options by the given network and pass the chain-specific network name on', function() {
    server.blockchainExplorerOpts = { eth: { testnet: { url: 'http://localhost:1234' } } };
    server._getBlockchainExplorer('eth', 'testnet').baseUrl.should.equal('http://localhost:1234/api/ETH/sepolia');
  });

  it('should log and return nothing when no explorer can be built', function() {
    server.blockchainExplorerOpts = {};
    const logw = sinon.spy(server, 'logw');
    should.not.exist(server._getBlockchainExplorer('eth', 'nonet'));
    logw.calledOnce.should.equal(true);
    logw.firstCall.args[1].message.should.equal('No url found for provider: v8:eth:nonet');
  });
});
