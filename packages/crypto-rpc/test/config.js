import { expect } from 'chai';
import sinon from 'sinon';
import Lightning from 'lightning';
import { CryptoRpc } from '../index.js';

// bitpay sets both the P2P port and the RPC port on BTC-family nodes, with credentials under rpcUser/rpcPass
const bitpayStyle = { host: '127.0.0.1', protocol: 'http', port: 20000, rpcPort: 20001, rpcUser: 'rpcuser', rpcPass: 'rpcpass' };
// bitcore-node passes only port/user/pass
const bitcoreNodeStyle = { host: '127.0.0.1', protocol: 'http', port: 8332, user: 'user', pass: 'pass' };

describe('CryptoRpc config', function() {
  describe('chain and config fields', function() {
    it('exposes the chain it was built for', function() {
      const cryptoRpc = new CryptoRpc({ chain: 'BTC', ...bitpayStyle });
      expect(cryptoRpc.chain).to.equal('BTC');
    });

    it('exposes the normalized config, keeping the caller\'s rpcPort', function() {
      const cryptoRpc = new CryptoRpc({ chain: 'BTC', ...bitpayStyle });
      expect(cryptoRpc.config).to.include({ host: '127.0.0.1', port: 20000, rpcPort: 20001, user: 'rpcuser', pass: 'rpcpass' });
    });

    it('returns the configured chain\'s rpc from get() with no currency', function() {
      const cryptoRpc = new CryptoRpc({ chain: 'BTC', ...bitpayStyle });
      expect(cryptoRpc.get()).to.equal(cryptoRpc.rpcs.BTC);
    });
  });
});
