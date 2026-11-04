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

  describe('BTC-family connection settings', function() {
    for (const chain of ['BTC', 'BCH', 'LTC', 'DOGE']) {
      it(`${chain} connects to rpcPort with rpcUser/rpcPass when both port and rpcPort are set`, function() {
        const { rpc } = new CryptoRpc({ chain, ...bitpayStyle }).get(chain);
        expect(rpc).to.include({ port: 20001, user: 'rpcuser', pass: 'rpcpass' });
      });

      it(`${chain} prefers rpcUser/rpcPass over user/pass`, function() {
        const { rpc } = new CryptoRpc({ chain, ...bitpayStyle, user: 'other', pass: 'other' }).get(chain);
        expect(rpc).to.include({ user: 'rpcuser', pass: 'rpcpass' });
      });

      it(`${chain} falls back to port/user/pass`, function() {
        const { rpc } = new CryptoRpc({ chain, ...bitcoreNodeStyle }).get(chain);
        expect(rpc).to.include({ port: 8332, user: 'user', pass: 'pass' });
      });
    }
  });

  describe('XRP connection settings', function() {
    it('connects to rpcPort when both port and rpcPort are set', function() {
      const xrpRpc = new CryptoRpc({ chain: 'XRP', host: '127.0.0.1', protocol: 'ws', port: 6006, rpcPort: 6005 }).get('XRP');
      expect(xrpRpc.rpc.url).to.equal('ws://127.0.0.1:6005');
    });

    it('falls back to port (bitcore-node passes only port)', function() {
      const xrpRpc = new CryptoRpc({ chain: 'XRP', host: '127.0.0.1', protocol: 'ws', port: 6006 }).get('XRP');
      expect(xrpRpc.rpc.url).to.equal('ws://127.0.0.1:6006');
    });
  });

  describe('LNBTC connection settings', function() {
    let authenticated;
    beforeEach(function() {
      authenticated = sinon.stub(Lightning, 'authenticatedLndGrpc').returns({ lnd: {} });
      sinon.stub(Lightning, 'unauthenticatedLndGrpc').returns({ lnd: {} });
    });
    afterEach(function() {
      sinon.restore();
    });

    it('connects to rpcPort when both port and rpcPort are set', function() {
      new CryptoRpc({ chain: 'LNBTC', host: '127.0.0.1', port: 9735, rpcPort: 10009, cert: 'c', macaroon: 'm' });
      expect(authenticated.firstCall.args[0].socket).to.equal('127.0.0.1:10009');
    });

    it('falls back to port', function() {
      new CryptoRpc({ chain: 'LNBTC', host: '127.0.0.1', port: 10009, cert: 'c', macaroon: 'm' });
      expect(authenticated.firstCall.args[0].socket).to.equal('127.0.0.1:10009');
    });
  });
});
