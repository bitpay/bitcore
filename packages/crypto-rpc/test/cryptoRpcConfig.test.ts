import { expect } from 'chai';
import { CryptoRpc } from '../index.js';

const baseConfig = { chain: 'BTC', host: '127.0.0.1', protocol: 'http', port: 8332, user: 'user', pass: 'pass' };

describe('CryptoRpc config', function() {
  it('exposes the chain it was built for', function() {
    const cryptoRpc = new CryptoRpc(baseConfig);
    expect(cryptoRpc.chain).to.equal('BTC');
  });

  it('exposes the normalized config', function() {
    const cryptoRpc = new CryptoRpc(baseConfig);
    expect(cryptoRpc.config).to.include({ host: '127.0.0.1', protocol: 'http', port: 8332, user: 'user', pass: 'pass' });
  });

  it('returns the configured chain\'s rpc from get() with no currency', function() {
    const cryptoRpc = new CryptoRpc(baseConfig);
    expect(cryptoRpc.get()).to.equal(cryptoRpc.rpcs.BTC);
  });

  it('uses rpcPort, rpcUser and rpcPass when port, user and pass are absent', function() {
    const { port, user, pass, ...rest } = baseConfig;
    const cryptoRpc = new CryptoRpc({ ...rest, rpcPort: 18332, rpcUser: 'rpcuser', rpcPass: 'rpcpass' });
    expect(cryptoRpc.config).to.include({ port: 18332, user: 'rpcuser', pass: 'rpcpass' });
  });

  it('prefers port, user and pass when both forms are given', function() {
    const cryptoRpc = new CryptoRpc({ ...baseConfig, rpcPort: 18332, rpcUser: 'rpcuser', rpcPass: 'rpcpass' });
    expect(cryptoRpc.config).to.include({ port: 8332, user: 'user', pass: 'pass' });
  });
});
