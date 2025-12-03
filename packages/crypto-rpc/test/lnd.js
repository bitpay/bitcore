import fs from 'fs';
import { expect } from 'chai';
import assert from 'assert';
import { CryptoRpc } from '../index.js';


const config1 = {
  chain: 'LNBTC',
  rpcPort: '11009',
  host: '172.28.0.5',
  cert: ''
};
const config2 = {
  chain: 'LNBTC',
  rpcPort: '11010',
  host: '172.28.0.10',
  cert: ''
};
const btcConfig = {
  chain: 'BTC',
  host: 'bitcoin',
  protocol: 'http',
  rpcPort: '8333',
  rpcUser: 'cryptorpc',
  rpcPass: 'local321',
  tokens: {},
  currencyConfig: {
    sendTo: '2NGFWyW3LBPr6StDuDSNFzQF3Jouuup1rua',
    unlockPassword: 'password',
    rawTx:
      '0100000001641ba2d21efa8db1a08c0072663adf4c4bc3be9ee5aabb530b2d4080b8a41cca000000006a4730440220062105df71eb10b5ead104826e388303a59d5d3d134af73cdf0d5e685650f95c0220188c8a966a2d586430d84aa7624152a556550c3243baad5415c92767dcad257f0121037aaa54736c5ffa13132e8ca821be16ce4034ae79472053dde5aa4347034bc0a2ffffffff0240787d010000000017a914c8241f574dfade4d446ec90cc0e534cb120b45e387eada4f1c000000001976a9141576306b9cc227279b2a6c95c2b017bb22b0421f88ac00000000'
  }
};

describe('LND Tests', function() {
  this.timeout(30000);
  const currency = 'LNBTC';
  const passphrase = 'password';
  let lightning1;
  let lightning2;
  let bitcoin;
  let lightningPublicKey2;
  let bitcoinWalletAddress;
  let invoice;

  before(async () => {
    // set up first lnd node
    const cert1 = fs.readFileSync('/root/.lnd/tls.cert');
    config1.cert = Buffer.from(cert1).toString('base64');
    const rpcs1 = new CryptoRpc(config1);
    lightning1 = rpcs1.get(currency);
    try {
      await lightning1.walletCreate({ passphrase });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      if (!err[2] || !err[2].err.message.includes('wallet already exists')) {
        throw err;
      }
    }
    const macaroon1 = fs.readFileSync('/root/.lnd/data/chain/bitcoin/regtest/admin.macaroon');
    config1.macaroon = Buffer.from(macaroon1).toString('base64');
    await lightning1.createNewAuthenticatedRpc(config1);


    // set up second lnd node
    const cert2 = fs.readFileSync('/root/.lnd2/tls.cert');
    config2.cert = Buffer.from(cert2).toString('base64');
    const rpcs2 = new CryptoRpc(config2);
    lightning2 = rpcs2.get(currency);
    try {
      await lightning2.walletCreate({ passphrase });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      if (!err[2] || !err[2].err.message.includes('wallet already exists')) {
        throw err;
      }
    }
    const macaroon2 = fs.readFileSync('/root/.lnd2/data/chain/bitcoin/regtest/admin.macaroon');
    config2.macaroon = Buffer.from(macaroon2).toString('base64');
    await lightning2.createNewAuthenticatedRpc(config2);


    // set up btc node
    const { currencyConfig } = btcConfig;
    const bitcoinRpcs = new CryptoRpc(btcConfig, currencyConfig);
    bitcoin = bitcoinRpcs.get('BTC');
    try {
      await bitcoin.asyncCall('createwallet', ['wallet0']);
      await bitcoin.asyncCall('encryptWallet', ['password']);
    } catch (err) {
      if (err.message.includes('Database already exists')) {
        await bitcoin.walletUnlock({ passphrase: btcConfig.currencyConfig.unlockPassword, time: 1000 });
      } else {
        throw err;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    bitcoinWalletAddress = await bitcoin.asyncCall('getnewaddress', ['wallet1']);
    await bitcoin.asyncCall('generatetoaddress', [120, bitcoinWalletAddress]);

    // wait for both lnd nodes to sync up to the btc node
    let syncing = true;
    while (syncing) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const walletInfo1 = await lightning1.getWalletInfo();
        const walletInfo2 = await lightning2.getWalletInfo();
        lightningPublicKey2 = walletInfo2.public_key;
        if (walletInfo1.is_synced_to_chain && walletInfo2.is_synced_to_chain) {
          syncing = false;
        }
      } catch (err) {
        if (err[2] && err[2].err.message.includes('wallet locked')) {
          await lightning1.walletUnlock({ passphrase });
          await lightning2.walletUnlock({ passphrase });
        } else {
          throw err;
        }
      }
    }

    await lightning1.asyncCall('addPeer', [{ socket: `${config2.host}`, public_key: lightningPublicKey2 }]);
  });

  it('should be able to derive and fund an on chain address', async () => {
    const walletAddress1 = await lightning1.getBTCAddress({});
    const walletAddress2 = await lightning2.getBTCAddress({});
    const isValid1 = await bitcoin.validateAddress({ address: walletAddress1.address });
    const isValid2 = await bitcoin.validateAddress({ address: walletAddress2.address });
    expect(isValid1).to.equal(true);
    expect(isValid2).to.equal(true);
    const txid1 = await bitcoin.unlockAndSendToAddress({ currency: 'BTC', address: walletAddress1.address, amount: '500000000', passphrase: btcConfig.currencyConfig.unlockPassword });
    const txid2 = await bitcoin.unlockAndSendToAddress({ currency: 'BTC', address: walletAddress1.address, amount: '500000000', passphrase: btcConfig.currencyConfig.unlockPassword });
    await bitcoin.asyncCall('generatetoaddress', [6, bitcoinWalletAddress]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(txid1).to.have.lengthOf(64);
    assert(txid1);
    expect(txid2).to.have.lengthOf(64);
    assert(txid2);
  });

  it('should be able to create a channel', async () => {
    await lightning1.openChannel({
      amount: 1000000,
      pubkey: lightningPublicKey2,
      socket: `${config2.host}:${config2.rpcPort}`
    });
    const pendingChannel = await lightning1.asyncCall('getPendingChannels');
    expect(pendingChannel.pending_channels.length).to.equal(1);
    expect(pendingChannel.pending_channels[0].capacity).to.equal(1000000);
    expect(pendingChannel.pending_channels[0].partner_public_key).to.equal(lightningPublicKey2);
    await bitcoin.asyncCall('generatetoaddress', [6, bitcoinWalletAddress]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { channels } = await lightning1.asyncCall('getChannels', []);
    expect(channels.length).to.equal(1);
    expect(channels[0].is_active).to.equal(true);
    expect(channels[0].capacity).to.equal(1000000);
    expect(channels[0].partner_public_key).to.equal(lightningPublicKey2);
  });

  it('should be able to create an invoice', async () => {
    const expiryDate = new Date() + 15 * 60 * 100;
    invoice = await lightning2.createInvoice({ id: 'lndinvoicetest', amount: 1000, expiry: expiryDate });
    expect(invoice.description).to.equal('lndinvoicetest');
    expect(invoice.tokens).to.equal(1000);
  });

  it('should be able to pay an invoice and detect payment', async () => {
    const invoiceListener = await lightning2.asyncCall('subscribeToInvoice', [{ id: invoice.id }]);
    invoiceListener.on('invoice_updated', (data) => {
      expect(data.tokens).to.equal(1000);
    });
    const payment = await lightning1.asyncCall('pay', [{
      request: invoice.request,
    }]);
    assert(payment.confirmed_at);
    expect(payment.paths.length).to.equal(1); // should have used one hop over channel
    expect(payment.mtokens).to.equal('1000000'); // total channel capacity
    expect(payment.tokens).to.equal(1000); // amount invoice was paid for
  });

  it('should be able to get past payments', async () => {
    await bitcoin.asyncCall('generatetoaddress', [6, bitcoinWalletAddress]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const payments = await lightning1.asyncCall('getPayment', [{ id: invoice.id }]);
    expect(payments.failed).to.not.exist;
    expect(payments.payment.tokens).to.equal(1000);
  });

  it('should be able to get server info', async () => {
    const info = await lightning1.getServerInfo({ currency });
    expect(info).to.have.property('chains');
    expect(info).to.have.property('color');
    expect(info).to.have.property('active_channels_count');
    expect(info).to.have.property('alias');
    expect(info).to.have.property('current_block_hash');
    expect(info).to.have.property('current_block_height');
    expect(info).to.have.property('features');
    expect(info).to.have.property('is_synced_to_chain');
    expect(info).to.have.property('is_synced_to_graph');
    expect(info).to.have.property('latest_block_at');
    expect(info).to.have.property('peers_count');
    expect(info).to.have.property('pending_channels_count');
    expect(info).to.have.property('public_key');
    expect(info).to.have.property('uris');
    expect(info).to.have.property('version');
  });
});
