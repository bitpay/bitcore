import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as sinon from 'sinon';
import request from 'request';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { XRP } from '../../../src/modules/ripple/api/csp';
import { XrpBlockStorage } from '../../../src/modules/ripple/models/block';
import { XrpTransactionStorage } from '../../../src/modules/ripple/models/transaction';
import { IXrpCoin, IXrpTransaction } from '../../../src/modules/ripple/types';
import { RippleTxs } from '../../fixtures/rippletxs.fixture';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Ripple Api', function() {
  const suite = this;
  const network = 'testnet';
  this.timeout(30000);

  before(intBeforeHelper);
  after(async () => {
    await intAfterHelper(suite);
    const client = await XRP.getClient(network);
    client.rpc.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('should be able to get the ledger', async () => {
    const client = await XRP.getClient(network);
    const { ledger } = await client.getBlock();
    expect(ledger).to.exist;
    expect(ledger.ledger_hash).to.exist;
  });

  it('should be able to get local tip', async () => {
    const chain = 'XRP';

    await XrpBlockStorage.collection.insertOne({
      chain,
      network,
      height: 5,
      hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
      time: new Date(1526326784),
      timeNormalized: new Date(1526326784),
      transactionCount: 1,
      reward: 50,
      previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
      nextBlockHash: '',
      size: 264,
      processed: true
    });

    const tip = await XRP.getLocalTip({ chain, network });
    expect(tip).to.exist;
    expect(tip.hash).to.exist;
    expect(tip.hash).to.eq('528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7');
  });

  for (const tx of RippleTxs) {
    it('should transform a ripple rpc response into a bitcore transaction: ' + tx.hash, async () => {
      const bitcoreTx = await XRP.transform(tx, 'testnet');
      expect(bitcoreTx).to.have.property('chain');
      expect(tx.Account).to.eq(bitcoreTx.from);
      expect(tx.ledger_index).to.eq(bitcoreTx.blockHeight);
      expect(tx.Fee).to.eq((bitcoreTx.fee).toString());
      const nodes = tx.meta.AffectedNodes.filter(node => 'ModifiedNode' in node && node.ModifiedNode.FinalFields?.Account == tx.Account);
      const sentVal = nodes.reduce((acc, node) => acc += 'ModifiedNode' in node ? Number(node.ModifiedNode.FinalFields?.Balance) - Number(node.ModifiedNode.PreviousFields?.Balance) : 0, 0);
      expect(sentVal).to.be.lt(0);
      if (tx.meta.delivered_amount) {
        const modNodes = tx.meta.AffectedNodes.filter(n => 'ModifiedNode' in n && n.ModifiedNode.FinalFields?.Account === bitcoreTx.to);
        const createNodes = tx.meta.AffectedNodes.filter(n => 'CreatedNode' in n && n.CreatedNode.NewFields.Account === bitcoreTx.to);
        expect(modNodes.length + createNodes.length > 0).to.equal(true);
        expect(tx.meta.delivered_amount).to.eq(bitcoreTx.value.toString());
        let receivedVal = modNodes.reduce((acc, node) => acc += 'ModifiedNode' in node ? Number(node.ModifiedNode.FinalFields?.Balance) - Number(node.ModifiedNode.PreviousFields?.Balance) : 0, 0);
        receivedVal += createNodes.reduce((acc, node) => acc += 'CreatedNode' in node ? Number(node.CreatedNode.NewFields.Balance) : 0, 0);
        expect(receivedVal).to.be.gt(0);
      }
    });
  }

  it('should tag txs from a wallet', async () => {
    const chain = 'XRP';
    const network = 'testnet';

    const wallet = new ObjectId();
    const address = 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm';
    await WalletAddressStorage.collection.insertOne({
      chain,
      network,
      wallet,
      address,
      processed: true
    });
    for (const tx of RippleTxs) {
      const bitcoreTx = (await XRP.transform(tx, network)) as IXrpTransaction;
      const bitcoreCoins = XRP.transformToCoins(tx, network);
      const { transaction, coins } = await XRP.tag(chain, network, bitcoreTx, bitcoreCoins);
      expect(transaction.wallets.length).eq(1);
      expect(transaction.wallets[0].equals(wallet));
      let hasACoin = false;
      for (const coin of coins) {
        if (coin.address == address) {
          hasACoin = true;
          expect(coin.wallets.length).eq(1);
          expect(coin.wallets[0].equals(wallet));
        }
      }
      expect(hasACoin).eq(true);
    }
  });

  it('should get sequence', async () => {
    const sequence = await XRP.getAccountNonce(network, 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
    expect(sequence).to.exist;
    expect(sequence).to.be.a('number');
  });

  it('should get flags', async () => {
    const flags = await XRP.getAccountFlags(network, 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
    expect(flags).to.exist;
    expect(flags).to.haveOwnProperty('requireDestinationTag');
  });

  it('should save tagged transactions to the database', async () => {
    const chain = 'XRP';
    const network = 'testnet';

    const wallet = new ObjectId();
    const address = 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm';
    await WalletAddressStorage.collection.insertOne({
      chain,
      network,
      wallet,
      address,
      processed: true
    });

    const blockTxs = new Array<IXrpTransaction>();
    const blockCoins = new Array<IXrpCoin>();

    for (const tx of RippleTxs) {
      const bitcoreTx = XRP.transform(tx, network) as IXrpTransaction;
      const bitcoreCoins = XRP.transformToCoins(tx, network);
      const { transaction, coins } = await XRP.tag(chain, network, bitcoreTx, bitcoreCoins);
      blockTxs.push(transaction);
      blockCoins.push(...coins);
    }
    await XrpTransactionStorage.batchImport({
      txs: blockTxs,
      coins: blockCoins,
      chain,
      network,
      initialSyncComplete: false
    });
    const walletTxs = await XrpTransactionStorage.collection.find({ chain, network, wallets: wallet }).toArray();

    expect(walletTxs.length).eq(RippleTxs.length);
  });

  describe('getBlockBeforeTime', () => {
    // For these tests, we simulate ledgers with a 1 second interval, so the close_time is xrpEpoch + (ledger_index * 1000)
    const xrpEpoch = new Date('2000-01-01T00:00:00.000Z');
    const getCloseTime = (ledgerIndex: number) => new Date(xrpEpoch.getTime() + (ledgerIndex * 1000));
    const sandbox = sinon.createSandbox();
    let requestStub;
    let validBody = {
      result: {
        status: 'success',
        ledger: {
          ledger_hash: 'abc123',
          ledger_index: 12,
          parent_hash: 'abc122',
          close_time: getCloseTime(12).getTime() / 1000,
          close_time_human: getCloseTime(12).toUTCString(),
          closed: true
        }
      }
    };

    let invalidBody = { result: { status: 'error' } };
    let time;
    const _configBak = XRP.config;

    before(async () => {
      await XrpBlockStorage.collection.deleteMany({});
    });

    beforeEach(async () => {
      requestStub = sandbox.stub(request, 'post');
      await XrpBlockStorage.collection.insertMany([{
        chain: 'XRP',
        network: 'testnet',
        height: 12,
        timeNormalized: getCloseTime(12),
        hash: 'abc123',
        time: getCloseTime(12),
        transactionCount: 1,
        reward: 50,
        previousBlockHash: 'abc122',
        nextBlockHash: 'abc124',
        size: 264,
        processed: true
      }, {
        chain: 'XRP',
        network: 'testnet',
        height: 13,
        timeNormalized: getCloseTime(13),
        hash: 'abc124',
        time: getCloseTime(13),
        transactionCount: 1,
        reward: 50,
        previousBlockHash: 'abc123',
        nextBlockHash: '',
        size: 264,
        processed: true
      }]);
      time = getCloseTime(12).toISOString();
    });

    afterEach(async () => {
      sandbox.restore();
      await XrpBlockStorage.collection.deleteMany({});
      XRP.config = _configBak;
    });

    it('should return block', async () => {
      requestStub.callsFake(function(req, cb) {
        validBody.result.ledger.ledger_index = req.body.params[0].ledger_index;
        validBody.result.ledger.close_time = getCloseTime(req.body.params[0].ledger_index).getTime() / 1000;
        validBody.result.ledger.close_time_human = new Date(validBody.result.ledger.close_time * 1000).toUTCString();
        return cb(null, { body: validBody });
      });
      const res = await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time });
      expect(res).to.deep.equal({
        chain: 'XRP',
        network: 'testnet',
        hash: 'abc123',
        height: 12,
        previousBlockHash: 'abc122',
        processed: true,
        time: getCloseTime(12),
        timeNormalized: getCloseTime(12),
        reward: 0,
        size: 0,
        transactionCount: 0,
        nextBlockHash: ''
      });
    });

    it('should respond null if date is too early', async () => {
      const res = await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time: getCloseTime(-1).toISOString() });
      expect(res).to.be.null;
    });

    it('should resolve on empty response', async () => {
      requestStub.callsArgWith(1, null, null);
      const res = await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time });
      expect(res).to.be.null;
    });

    it('should throw on invalid time', async () => {
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time: 'not-a-time' });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Invalid time value')
      }
    });

    it('should throw on response error', async () => {
      requestStub.callsArgWith(1, 'Unresponsive server', validBody);
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.equal('Unresponsive server')
      }
    });

    it('should return null on error response', async () => {
      requestStub.callsArgWith(1, null, invalidBody);
      const res = await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time });
      expect(res).to.be.null;
    });

    it('should throw on mis-configuration', async () => {
      requestStub.callsArgWith(1, null, validBody);
      XRP.config = {};
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time });
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Cannot read properties of undefined (reading \'provider\')')
      }
    });
  });
});
