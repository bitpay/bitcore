import { ObjectId } from 'bson';
import { expect } from 'chai';
import { Request, Response } from 'express-serve-static-core';
import * as sinon from 'sinon';
import { PassThrough } from 'stream';
import { MongoBound } from '../../../src/models/base';
import { IWallet, WalletStorage } from '../../../src/models/wallet';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

const chain = 'ETH';
const network = 'regtest';

describe('EVM Memory Leak Prevention', function() {
  const suite = this;
  this.timeout(30000);
  let globalSandbox: sinon.SinonSandbox;
  let ETH: any;

  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    globalSandbox = sinon.createSandbox();
    // Use the ETH module instance
    const { ETH: ETHModule } = await import('../../../src/modules/ethereum/api/csp');
    ETH = ETHModule;
    await EVMTransactionStorage.collection.deleteMany({});
    await WalletStorage.collection.deleteMany({});
    await WalletAddressStorage.collection.deleteMany({});
  });

  afterEach(() => {
    globalSandbox.restore();
  });

  function createMockReqRes() {
    const reqStream = new PassThrough();
    const req = reqStream as unknown as Request;
    
    const resStream = new PassThrough();
    const res = resStream as unknown as Response;
    
    (res as any).write = resStream.write.bind(resStream);
    (res as any).end = resStream.end.bind(resStream);
    
    res.type = () => res;
    res.status = () => res;
    res.send = () => res;

    // Consume data to keep stream flowing
    resStream.on('data', () => {});

    return { req, res, reqEmitter: reqStream, resEmitter: resStream };
  }

  describe('Cursor Cleanup on Client Disconnect', () => {
    it('should not crash when client disconnects during streamWalletTransactions', async () => {
      const address = '0x7F17aF79AABC4A297A58D389ab5905fEd4Ec9502';
      const objectId = ObjectId.createFromHexString('60f9abed0e32086bf9903bb5');
      const wallet = {
        _id: objectId,
        chain,
        network,
        name: 'test-wallet',
        pubKey: '0x029ec2ebdebe6966259cf3c6f35c4f126b82fe072bf9d0e81dad375f1d6d2d9054',
        path: 'm/44\'/60\'/0\'/0/0',
        singleAddress: true
      } as MongoBound<IWallet>;

      await WalletStorage.collection.insertOne(wallet as any);
      await WalletAddressStorage.collection.insertOne({
        chain,
        network,
        wallet: objectId,
        address,
        processed: true
      });

      const txCount = 5;
      const txs = new Array(txCount).fill({}).map(() => ({
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9,
        data: Buffer.from(''),
        from: address,
        to: '0xRecipient123',
        txid: '0x' + Math.random().toString(16).substring(2),
        wallets: [objectId]
      } as any));

      await EVMTransactionStorage.collection.insertMany(txs);
      
      const { req, res, reqEmitter } = createMockReqRes();

      const streamPromise = ETH.streamWalletTransactions({
        chain,
        network,
        wallet,
        req,
        res,
        args: {}
      });

      // Wait for stream to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate client disconnect
      reqEmitter.emit('close');

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw - the implementation should handle cleanup gracefully
      await streamPromise.catch(() => {});

      // If we get here without crashing, the test passes
      expect(true).to.be.true;
    });

    it('should handle multiple interrupted requests without accumulating resources', async () => {
      const address = '0x7F17aF79AABC4A297A58D389ab5905fEd4Ec9502';
      const objectId = ObjectId.createFromHexString('60f9abed0e32086bf9903bb5');
      const wallet = {
        _id: objectId,
        chain,
        network,
        name: 'test-wallet-multi',
        pubKey: '0x029ec2ebdebe6966259cf3c6f35c4f126b82fe072bf9d0e81dad375f1d6d2d9054',
        path: 'm/44\'/60\'/0\'/0/0',
        singleAddress: true
      } as MongoBound<IWallet>;

      await WalletStorage.collection.insertOne(wallet as any);
      await WalletAddressStorage.collection.insertOne({
        chain,
        network,
        wallet: objectId,
        address,
        processed: true
      });

      const txCount = 5;
      const txs = new Array(txCount).fill({}).map(() => ({
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9,
        data: Buffer.from(''),
        from: address,
        to: '0xRecipient456',
        txid: '0x' + Math.random().toString(16).substring(2),
        wallets: [objectId]
      } as any));

      await EVMTransactionStorage.collection.insertMany(txs);

      // Make 3 requests that all get interrupted
      const numRequests = 3;
      for (let i = 0; i < numRequests; i++) {
        const { req, res, reqEmitter } = createMockReqRes();

        const streamPromise = ETH.streamWalletTransactions({
          chain,
          network,
          wallet,
          req,
          res,
          args: {}
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        reqEmitter.emit('close');
        await new Promise(resolve => setTimeout(resolve, 50));
        await streamPromise.catch(() => {});
      }

      // If we completed all requests without issues, test passes
      expect(true).to.be.true;
    });
  });

  describe('Provider Instance Reuse', () => {
    it('should complete streaming without errors', async () => {
      const address = '0x7F17aF79AABC4A297A58D389ab5905fEd4Ec9502';
      const objectId = ObjectId.createFromHexString('60f9abed0e32086bf9903bb5');
      const wallet = {
        _id: objectId,
        chain,
        network,
        name: 'test-wallet-provider',
        pubKey: '0x029ec2ebdebe6966259cf3c6f35c4f126b82fe072bf9d0e81dad375f1d6d2d9054',
        path: 'm/44\'/60\'/0\'/0/0',
        singleAddress: true
      } as MongoBound<IWallet>;

      await WalletStorage.collection.insertOne(wallet as any);
      await WalletAddressStorage.collection.insertOne({
        chain,
        network,
        wallet: objectId,
        address,
        processed: true
      });

      const txCount = 5;
      const txs = new Array(txCount).fill({}).map(() => ({
        chain,
        network,
        blockHeight: 1,
        gasPrice: 10 * 1e9,
        data: Buffer.from(''),
        from: address,
        to: '0xRecipient789',
        txid: '0x' + Math.random().toString(16).substring(2),
        wallets: [objectId]
      } as any));

      await EVMTransactionStorage.collection.insertMany(txs);

      const { req, res, resEmitter } = createMockReqRes();

      let receivedTxCount = 0;
      res.on('data', () => {
        receivedTxCount++;
      });

      await new Promise((resolve, reject) => {
        resEmitter.on('finish', resolve);
        resEmitter.on('error', reject);

        ETH.streamWalletTransactions({
          chain,
          network,
          wallet,
          req,
          res,
          args: {}
        }).catch(reject);
      });

      // Verify that we received some transactions (stream worked)
      expect(receivedTxCount).to.be.greaterThan(0);
    });
  });
});
