'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import { WalletService } from '../src/lib/server';

chai.should();

type TxItem = {
  id: string;
  txid: string;
  confirmations: number;
  blockheight: number;
};

function makeTx(id: number): TxItem {
  return {
    id: `id${id}`,
    txid: `txid${id}`,
    confirmations: 100 - id,
    blockheight: 1000 - id
  };
}

function callGetTxHistoryV8(service: WalletService, bc, wallet, opts, skip: number, limit: number) {
  return new Promise<any>((resolve, reject) => {
    service.getTxHistoryV8(bc, wallet, opts, skip, limit, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

describe('TxHistory Paging', function() {
  function buildService(initialCacheNewest: TxItem[], getBcNewest: () => TxItem[]) {
    let cacheNewest = initialCacheNewest.slice();
    let streamKey: string | null = null;
    let streamItems: TxItem[] | null = null;

    const service = Object.create(WalletService.prototype) as WalletService & {
      storage: any;
      syncWallet: any;
      _getBlockchainHeight: any;
      _normalizeTxHistory: any;
      userAgent: string;
    };

    service.userAgent = 'txhistory-test-agent';
    service.syncWallet = (_wallet, next) => next();
    service._getBlockchainHeight = (_chain, _network, cb) => cb(null, 1000, 'test-hash');
    service._normalizeTxHistory = (_walletCacheKey, _txs, _dustThreshold, _bcHeight, cb) => cb(null, getBcNewest());
    service.storage = {
      getTxHistoryCacheStatusV8: (_walletCacheKey, cb) =>
        cb(null, {
          updatedHeight: 0,
          tipIndex: cacheNewest.length ? cacheNewest.length - 1 : null,
          tipTxId: cacheNewest.length ? cacheNewest[0].txid : null,
          tipHeight: cacheNewest.length ? cacheNewest[0].blockheight : null
        }),
      getTxHistoryStreamV8: (_walletCacheKey, cb) =>
        cb(null, streamKey && streamItems ? { streamKey, items: streamItems.slice() } : null),
      clearTxHistoryStreamV8: (_walletCacheKey, cb) => {
        streamKey = null;
        streamItems = null;
        cb();
      },
      storeTxHistoryStreamV8: (_walletCacheKey, inStreamKey, items, cb) => {
        streamKey = inStreamKey;
        streamItems = items.slice();
        cb();
      },
      getTxHistoryCacheV8: (_walletCacheKey, skip, limit, cb) => cb(null, cacheNewest.slice(skip, skip + limit)),
      storeTxHistoryCacheV8: (_walletCacheKey, _tipIndex, items, _updateHeight, cb) => {
        cacheNewest = items.concat(cacheNewest);
        cb();
      }
    };

    const bc = {
      getTransactions: (_wallet, _startBlock, cb) => cb(null, [])
    };
    const wallet = {
      id: 'wallet1',
      chain: 'btc',
      network: 'livenet'
    };

    return { service, bc, wallet };
  }

  it('should preserve newest-first skip behavior by default', async function() {
    const cacheNewest = [makeTx(5), makeTx(6), makeTx(7)];
    const bcNewest = [makeTx(0), makeTx(1), makeTx(2), makeTx(3), makeTx(4)];
    const { service, bc, wallet } = buildService(cacheNewest, () => bcNewest);

    const result = await callGetTxHistoryV8(service, bc, wallet, {}, 2, 2);

    result.items.map(tx => tx.id).should.deep.equal(['id2', 'id3']);
  });

  it('should return oldest-first pages when reverse is set', async function() {
    const cacheNewest = [makeTx(5), makeTx(6), makeTx(7)];
    const bcNewest = [makeTx(0), makeTx(1), makeTx(2), makeTx(3), makeTx(4)];
    const { service, bc, wallet } = buildService(cacheNewest, () => bcNewest);

    const result = await callGetTxHistoryV8(service, bc, wallet, { reverse: true }, 0, 2);

    result.items.map(tx => tx.id).should.deep.equal(['id7', 'id6']);
  });

  it('should keep reverse skip stable when new transactions arrive at the tip', async function() {
    const cacheNewest = [makeTx(5), makeTx(6), makeTx(7)];
    let bcNewest = [makeTx(0), makeTx(1), makeTx(2), makeTx(3), makeTx(4)];
    const { service, bc, wallet } = buildService(cacheNewest, () => bcNewest);

    const firstPage = await callGetTxHistoryV8(service, bc, wallet, { reverse: true }, 0, 2);
    firstPage.items.map(tx => tx.id).should.deep.equal(['id7', 'id6']);

    bcNewest = [
      {
        id: 'newid0',
        txid: 'newtxid0',
        confirmations: 0,
        blockheight: -1
      },
      {
        id: 'newid1',
        txid: 'newtxid1',
        confirmations: 0,
        blockheight: -1
      },
      ...bcNewest
    ];

    const secondPage = await callGetTxHistoryV8(service, bc, wallet, { reverse: true }, 2, 2);
    secondPage.items.map(tx => tx.id).should.deep.equal(['id5', 'id4']);
  });

  it('should trim streamed txs that were promoted into cache before reverse paging', async function() {
    const cacheNewest = [makeTx(3)];
    const bcNewest = [makeTx(0), makeTx(1), makeTx(2), makeTx(3)];
    const { service, bc, wallet } = buildService(cacheNewest, () => bcNewest);

    const firstPage = await callGetTxHistoryV8(service, bc, wallet, { reverse: true }, 0, 2);
    firstPage.useStream.should.equal(false);
    firstPage.items.map(tx => tx.id).should.deep.equal(['id3', 'id2']);

    const secondPage = await callGetTxHistoryV8(service, bc, wallet, { reverse: true }, 2, 2);
    secondPage.useStream.should.equal(true);
    secondPage.items.map(tx => tx.id).should.deep.equal(['id1', 'id0']);
  });

  it('should trim streamed txs that were promoted into cache before newest-first paging', async function() {
    const cacheNewest = [makeTx(3)];
    const bcNewest = [makeTx(0), makeTx(1), makeTx(2), makeTx(3)];
    const { service, bc, wallet } = buildService(cacheNewest, () => bcNewest);

    const firstPage = await callGetTxHistoryV8(service, bc, wallet, {}, 0, 2);
    firstPage.useStream.should.equal(false);
    firstPage.items.map(tx => tx.id).should.deep.equal(['id0', 'id1']);

    const secondPage = await callGetTxHistoryV8(service, bc, wallet, {}, 2, 2);
    secondPage.useStream.should.equal(true);
    secondPage.items.map(tx => tx.id).should.deep.equal(['id2', 'id3']);
  });
});
