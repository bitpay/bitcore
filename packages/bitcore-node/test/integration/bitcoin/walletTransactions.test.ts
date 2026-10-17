import { expect } from 'chai';
import { ObjectID } from 'mongodb';
import { CoinStorage } from '../../../src/models/coin';
import { TransactionStorage } from '../../../src/models/transaction';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

/**
 * Pins the rows produced by /wallet/:pubKey/transactions (streamWalletTransactions + ListTransactionsStream)
 * for a fixed graph of txs and coins, across every query-arg combination the route accepts.
 *
 * The row tests compare rows per tx: tx order must match exactly, non-fee rows are compared sorted by
 * outputIndex, and the fee row (when present) must be the tx's last row. Output order within a tx is
 * not asserted, since the query does not define it.
 */
describe('Bitcoin wallet transaction history', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);

  const chain = 'BTC';
  const network = 'regtest';
  const newWallet = (walletNetwork = network) => ({ _id: new ObjectID(), chain, network: walletNetwork }) as any;
  const walletA = newWallet();
  const walletB = newWallet();
  const walletTestnet3 = newWallet('testnet3');
  const walletTestnet4 = newWallet('testnet4');
  const walletEdge = newWallet();
  const walletPayout = newWallet();
  const walletMany = newWallet();

  const A1 = 'bcrt1qwalletaaddress1';
  const A2 = 'bcrt1qwalletaaddress2';
  const B1 = 'bcrt1qwalletbaddress1';
  const E1 = 'bcrt1qwalletedgeaddress';
  const P1 = 'bcrt1qwalletpayoutaddress';
  const X = 'bcrt1qexternaladdress';
  const payee = (i: number) => `bcrt1qpayee${i}`;

  const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();
  const at = (minutes: number) => new Date(baseTime + minutes * 60 * 1000);
  const txid = (n: number) => n.toString(16).padStart(64, '0');

  type TxFixture = {
    _id?: ObjectID;
    txid: string;
    network?: string;
    blockHeight: number;
    blockTimeNormalized: Date;
    fee: number;
    size: number;
    wallets: ObjectID[];
  };
  type CoinFixture = {
    chain?: string;
    network?: string;
    mintTxid: string;
    mintIndex: number;
    mintHeight: number;
    address: string;
    value: number;
    wallets: ObjectID[];
    spentTxid?: string;
    spentHeight?: number;
  };

  // walletA (with walletB): confirmed txs at heights 100..105, then a conflicting tx and two mempool txs
  const T1: TxFixture = { txid: txid(1), blockHeight: 100, blockTimeNormalized: at(0), fee: 0, size: 100, wallets: [walletA._id] };
  const T2: TxFixture = { txid: txid(2), blockHeight: 101, blockTimeNormalized: at(10), fee: 500, size: 200, wallets: [walletA._id] };
  const T3: TxFixture = { txid: txid(3), blockHeight: 102, blockTimeNormalized: at(20), fee: 1000, size: 250, wallets: [walletA._id] };
  const T4: TxFixture = { txid: txid(4), blockHeight: 103, blockTimeNormalized: at(30), fee: 500, size: 150, wallets: [walletA._id] };
  const T5: TxFixture = { txid: txid(5), blockHeight: 104, blockTimeNormalized: at(40), fee: 1000, size: 180, wallets: [walletA._id, walletB._id] };
  const T6: TxFixture = { txid: txid(6), blockHeight: 105, blockTimeNormalized: at(50), fee: 400, size: 220, wallets: [walletA._id, walletB._id] };
  const T9: TxFixture = { txid: txid(9), blockHeight: -3, blockTimeNormalized: at(55), fee: 200, size: 140, wallets: [walletA._id] };
  const T7: TxFixture = { txid: txid(7), blockHeight: -1, blockTimeNormalized: at(60), fee: 250, size: 160, wallets: [walletA._id] };
  const T8: TxFixture = { txid: txid(8), blockHeight: -1, blockTimeNormalized: at(70), fee: 300, size: 190, wallets: [walletA._id] };
  const allA = [T1, T2, T3, T4, T5, T6, T9, T7, T8];

  // BTC testnet3/testnet4 wallets, queried as network 'testnet'
  const TT3: TxFixture = { txid: txid(0x100), network: 'testnet3', blockHeight: 50, blockTimeNormalized: at(5), fee: 100, size: 120, wallets: [walletTestnet3._id] };
  const TT4: TxFixture = { txid: txid(0x101), network: 'testnet4', blockHeight: 60, blockTimeNormalized: at(6), fee: 100, size: 120, wallets: [walletTestnet4._id] };

  // walletEdge: a receive whose wallet outputs were inserted out of order, then a send with no fee
  const ER: TxFixture = { txid: txid(0x200), blockHeight: 500, blockTimeNormalized: at(300), fee: 300, size: 200, wallets: [walletEdge._id] };
  const ES: TxFixture = { txid: txid(0x201), blockHeight: 501, blockTimeNormalized: at(310), fee: 0, size: 150, wallets: [walletEdge._id] };

  // walletPayout: a funding receive, then three payouts of 5 outputs + change, each spending the previous change
  const PAYEES = 5;
  const PR: TxFixture = { txid: txid(0x300), blockHeight: 300, blockTimeNormalized: at(400), fee: 200, size: 200, wallets: [walletPayout._id] };
  const payouts: TxFixture[] = [1, 2, 3].map(i => ({
    txid: txid(0x300 + i),
    blockHeight: 300 + i,
    blockTimeNormalized: at(400 + i),
    fee: 1000 + i,
    size: 400,
    wallets: [walletPayout._id]
  }));
  const allPayout = [PR, ...payouts];

  // walletMany: many single-output receives, to show query counts don't grow with the number of txs
  const MANY = 250;
  const manyTxs: TxFixture[] = Array.from({ length: MANY }, (_, i) => ({
    txid: txid(0x1000 + i),
    blockHeight: 200 + i,
    blockTimeNormalized: at(1000 + i),
    fee: 150,
    size: 110,
    wallets: [walletMany._id]
  }));

  const allTxs = [...allA, TT3, TT4, ER, ES, ...allPayout, ...manyTxs];

  const coins: CoinFixture[] = [
    // external input to T2; not owned by any wallet, so T2 is a receive for walletA
    { mintTxid: txid(0xe1), mintIndex: 0, mintHeight: 90, address: X, value: 40500, wallets: [], spentTxid: T2.txid, spentHeight: 101 },
    // T1: coinbase to A1
    { mintTxid: T1.txid, mintIndex: 0, mintHeight: 100, address: A1, value: 50000, wallets: [walletA._id], spentTxid: T3.txid, spentHeight: 102 },
    // T2: external -> A2, plus an output to someone else
    { mintTxid: T2.txid, mintIndex: 0, mintHeight: 101, address: A2, value: 30000, wallets: [walletA._id], spentTxid: T4.txid, spentHeight: 103 },
    { mintTxid: T2.txid, mintIndex: 1, mintHeight: 101, address: X, value: 10000, wallets: [] },
    // T3: walletA spends T1:0 -> external X, change to A2
    { mintTxid: T3.txid, mintIndex: 0, mintHeight: 102, address: X, value: 20000, wallets: [] },
    { mintTxid: T3.txid, mintIndex: 1, mintHeight: 102, address: A2, value: 29000, wallets: [walletA._id], spentTxid: T5.txid, spentHeight: 104 },
    // same txid on another chain (shared pre-fork history) and on another network of this chain; must never
    // show up for a BTC regtest wallet
    { chain: 'BCH', mintTxid: T3.txid, mintIndex: 0, mintHeight: 102, address: 'bchreg:qforkcoin', value: 77777, wallets: [] },
    { network: 'testnet3', mintTxid: T3.txid, mintIndex: 0, mintHeight: 102, address: 'tb1qothernetworkcoin', value: 66666, wallets: [] },
    // T4: walletA spends T2:0 entirely back to itself
    { mintTxid: T4.txid, mintIndex: 0, mintHeight: 103, address: A1, value: 29500, wallets: [walletA._id], spentTxid: T8.txid, spentHeight: -1 },
    // T5: walletA spends T3:1 -> walletB
    { mintTxid: T5.txid, mintIndex: 0, mintHeight: 104, address: B1, value: 28000, wallets: [walletB._id], spentTxid: T6.txid, spentHeight: 105 },
    // T6: walletB spends T5:0 -> walletA, change back to walletB
    { mintTxid: T6.txid, mintIndex: 0, mintHeight: 105, address: A1, value: 10000, wallets: [walletA._id] },
    { mintTxid: T6.txid, mintIndex: 1, mintHeight: 105, address: B1, value: 17600, wallets: [walletB._id] },
    // T9: conflicting receive to A2
    { mintTxid: T9.txid, mintIndex: 0, mintHeight: -3, address: A2, value: 3000, wallets: [walletA._id] },
    // T7: mempool receive to A2
    { mintTxid: T7.txid, mintIndex: 0, mintHeight: -1, address: A2, value: 5000, wallets: [walletA._id] },
    { mintTxid: T7.txid, mintIndex: 1, mintHeight: -1, address: X, value: 1234, wallets: [] },
    // T8: mempool spend of T4:0 -> external X, change to A1
    { mintTxid: T8.txid, mintIndex: 0, mintHeight: -1, address: X, value: 1000, wallets: [] },
    { mintTxid: T8.txid, mintIndex: 1, mintHeight: -1, address: A1, value: 28200, wallets: [walletA._id] },
    // testnet receives
    { network: 'testnet3', mintTxid: TT3.txid, mintIndex: 0, mintHeight: 50, address: 'tb1qtestnet3address', value: 4200, wallets: [walletTestnet3._id] },
    { network: 'testnet4', mintTxid: TT4.txid, mintIndex: 0, mintHeight: 60, address: 'tb1qtestnet4address', value: 4300, wallets: [walletTestnet4._id] },
    // ER: three wallet outputs, inserted as 2, 0, 1
    { mintTxid: ER.txid, mintIndex: 2, mintHeight: 500, address: E1, value: 3000, wallets: [walletEdge._id] },
    { mintTxid: ER.txid, mintIndex: 0, mintHeight: 500, address: E1, value: 1000, wallets: [walletEdge._id], spentTxid: ES.txid, spentHeight: 501 },
    { mintTxid: ER.txid, mintIndex: 1, mintHeight: 500, address: E1, value: 2000, wallets: [walletEdge._id] },
    // ES: spends ER:0 to an external address with no fee
    { mintTxid: ES.txid, mintIndex: 0, mintHeight: 501, address: X, value: 1000, wallets: [] },
    // PR: funding receive
    { mintTxid: PR.txid, mintIndex: 0, mintHeight: 300, address: P1, value: 1000000, wallets: [walletPayout._id], spentTxid: payouts[0].txid, spentHeight: 301 },
    { mintTxid: PR.txid, mintIndex: 1, mintHeight: 300, address: X, value: 500, wallets: [] },
    // payouts: PAYEES external outputs, then change, which the next payout spends
    ...payouts.flatMap((tx, p) => [
      ...Array.from({ length: PAYEES }, (_, i) => ({ mintTxid: tx.txid, mintIndex: i, mintHeight: tx.blockHeight, address: payee(i), value: 10000, wallets: [] })),
      {
        mintTxid: tx.txid,
        mintIndex: PAYEES,
        mintHeight: tx.blockHeight,
        address: P1,
        value: 900000 - p * 60000,
        wallets: [walletPayout._id],
        ...(payouts[p + 1] ? { spentTxid: payouts[p + 1].txid, spentHeight: payouts[p + 1].blockHeight } : {})
      }
    ]),
    // walletMany receives
    ...manyTxs.map(tx => ({ mintTxid: tx.txid, mintIndex: 0, mintHeight: tx.blockHeight, address: 'bcrt1qmanyreceives', value: 1000, wallets: [walletMany._id] }))
  ];

  type Row = Record<string, any>;
  const outputRow = (tx: TxFixture, category: string, outputIndex: number, address: string, satoshis: number): Row => ({
    id: tx._id!.toHexString(),
    txid: tx.txid,
    fee: tx.fee,
    size: tx.size,
    category,
    satoshis,
    height: tx.blockHeight,
    address,
    outputIndex,
    blockTime: tx.blockTimeNormalized.toISOString()
  });
  const feeRow = (tx: TxFixture): Row => ({
    id: tx._id!.toHexString(),
    txid: tx.txid,
    category: 'fee',
    satoshis: -tx.fee,
    height: tx.blockHeight,
    blockTime: tx.blockTimeNormalized.toISOString()
  });

  // walletA's view of every tx, in blockTimeNormalized order
  const expectedA = () => ({
    [T1.txid]: [outputRow(T1, 'receive', 0, A1, 50000)],
    [T2.txid]: [outputRow(T2, 'receive', 0, A2, 30000)],
    [T3.txid]: [outputRow(T3, 'send', 0, X, -20000), outputRow(T3, 'move', 1, A2, -29000), feeRow(T3)],
    [T4.txid]: [outputRow(T4, 'move', 0, A1, -29500), feeRow(T4)],
    [T5.txid]: [outputRow(T5, 'send', 0, B1, -28000), feeRow(T5)],
    [T6.txid]: [outputRow(T6, 'receive', 0, A1, 10000)],
    [T9.txid]: [outputRow(T9, 'receive', 0, A2, 3000)],
    [T7.txid]: [outputRow(T7, 'receive', 0, A2, 5000)],
    [T8.txid]: [outputRow(T8, 'send', 0, X, -1000), outputRow(T8, 'move', 1, A1, -28200), feeRow(T8)]
  });
  const expectedB = () => ({
    [T5.txid]: [outputRow(T5, 'receive', 0, B1, 28000)],
    [T6.txid]: [outputRow(T6, 'send', 0, A1, -10000), outputRow(T6, 'move', 1, B1, -17600), feeRow(T6)]
  });
  const expectedEdge = () => ({
    [ER.txid]: [outputRow(ER, 'receive', 0, E1, 1000), outputRow(ER, 'receive', 1, E1, 2000), outputRow(ER, 'receive', 2, E1, 3000)],
    [ES.txid]: [outputRow(ES, 'send', 0, X, -1000)]
  });
  const expectedPayout = () => ({
    [PR.txid]: [outputRow(PR, 'receive', 0, P1, 1000000)],
    ...Object.fromEntries(
      payouts.map((tx, p) => [
        tx.txid,
        [
          ...Array.from({ length: PAYEES }, (_, i) => outputRow(tx, 'send', i, payee(i), -10000)),
          outputRow(tx, 'move', PAYEES, P1, -(900000 - p * 60000)),
          feeRow(tx)
        ]
      ])
    )
  });

  // resolve the BTC provider via regtest (the only BTC network configured in tests) so queryNetwork can differ
  const defaultProvider = () => ChainStateProvider.get({ chain, network });
  const parseRows = (chunks: any[]): Row[] =>
    chunks
      .join('')
      .split('\n')
      .filter(line => line)
      .map(line => JSON.parse(line));

  async function openStream(wallet: any, args: any, queryNetwork = wallet.network, provider: any = defaultProvider()) {
    return provider.streamWalletTransactions({ chain, network: queryNetwork, wallet, args });
  }

  async function streamRows(wallet: any, args: any, queryNetwork = wallet.network, provider: any = defaultProvider()): Promise<Row[]> {
    const stream = await openStream(wallet, args, queryNetwork, provider);
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return parseRows(chunks);
  }

  function expectRows(rows: Row[], expected: Record<string, Row[]>, txOrder: TxFixture[]) {
    const groups: { txid: string; rows: Row[] }[] = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (last && last.txid === row.txid) {
        last.rows.push(row);
      } else {
        groups.push({ txid: row.txid, rows: [row] });
      }
    }
    expect(groups.map(g => g.txid), 'tx order').to.deep.equal(txOrder.map(t => t.txid));
    for (const group of groups) {
      const expectedRows = expected[group.txid];
      const byIndex = (a: Row, b: Row) => a.outputIndex - b.outputIndex;
      const actualFee = group.rows.filter(r => r.category === 'fee');
      const expectedFee = expectedRows.filter(r => r.category === 'fee');
      expect(group.rows.filter(r => r.category !== 'fee').sort(byIndex), `rows for ${group.txid}`).to.deep.equal(
        expectedRows.filter(r => r.category !== 'fee').sort(byIndex)
      );
      expect(actualFee, `fee row for ${group.txid}`).to.deep.equal(expectedFee);
      if (expectedFee.length) {
        expect(group.rows[group.rows.length - 1].category, `fee row is last for ${group.txid}`).to.equal('fee');
      }
    }
  }

  before(async () => {
    await intBeforeHelper();
    await resetDatabase();
    for (const tx of allTxs) {
      const { insertedId } = await TransactionStorage.collection.insertOne({
        chain,
        network: tx.network || network,
        txid: tx.txid,
        blockHeight: tx.blockHeight,
        blockHash: tx.blockHeight >= 0 ? txid(0xb000 + tx.blockHeight) : undefined,
        blockTime: tx.blockTimeNormalized,
        blockTimeNormalized: tx.blockTimeNormalized,
        fee: tx.fee,
        size: tx.size,
        value: 0,
        coinbase: tx === T1,
        wallets: tx.wallets
      } as any);
      tx._id = insertedId as ObjectID;
    }
    await CoinStorage.collection.insertMany(
      coins.map(coin => ({
        chain: coin.chain || chain,
        network: coin.network || network,
        mintTxid: coin.mintTxid,
        mintIndex: coin.mintIndex,
        mintHeight: coin.mintHeight,
        coinbase: coin.mintTxid === T1.txid,
        value: coin.value,
        address: coin.address,
        script: Buffer.from(''),
        wallets: coin.wallets,
        spentTxid: coin.spentTxid || '',
        spentHeight: coin.spentHeight ?? -2
      })) as any
    );
  });

  after(async () => {
    await resetDatabase();
    await intAfterHelper(suite);
  });

  it('returns every wallet tx with send/move/receive/fee rows when no args are given', async () => {
    const rows = await streamRows(walletA, {});
    expectRows(rows, expectedA(), allA);
  });

  it('only emits receive rows for the outputs the wallet owns', async () => {
    const rows = await streamRows(walletA, {});
    expect(rows.filter(r => r.txid === T2.txid)).to.deep.equal(expectedA()[T2.txid]);
    expect(rows.filter(r => r.txid === T7.txid)).to.deep.equal(expectedA()[T7.txid]);
  });

  it('scopes a send\'s outputs to its own chain and network when another shares the txid', async () => {
    const rows = await streamRows(walletA, {});
    const t3 = rows.filter(r => r.txid === T3.txid);
    expectRows(t3, { [T3.txid]: expectedA()[T3.txid] }, [T3]);
    const amounts = rows.map(r => r.satoshis);
    expect(amounts, 'other-chain coin').to.not.include(-77777);
    expect(amounts, 'other-network coin').to.not.include(-66666);
  });

  it('reports the same txs from the other wallet\'s point of view', async () => {
    const rows = await streamRows(walletB, {});
    expectRows(rows, expectedB(), [T5, T6]);
  });

  it('omits the fee row for a send with no fee', async () => {
    const rows = await streamRows(walletEdge, {});
    expectRows(rows, expectedEdge(), [ER, ES]);
    expect(rows.filter(r => r.category === 'fee')).to.deep.equal([]);
  });

  it('emits every output of a multi-output payout', async () => {
    const rows = await streamRows(walletPayout, {});
    expectRows(rows, expectedPayout(), allPayout);
  });

  it('filters by startBlock and excludes mempool and conflicting txs', async () => {
    const rows = await streamRows(walletA, { startBlock: '102' });
    expectRows(rows, expectedA(), [T3, T4, T5, T6]);
  });

  it('adds mempool txs (but not conflicting ones) with startBlock + includeMempool', async () => {
    const rows = await streamRows(walletA, { startBlock: '102', includeMempool: 'true' });
    expectRows(rows, expectedA(), [T3, T4, T5, T6, T7, T8]);
  });

  it('filters by startBlock + endBlock', async () => {
    const rows = await streamRows(walletA, { startBlock: '102', endBlock: '104' });
    expectRows(rows, expectedA(), [T3, T4, T5]);
  });

  it('matches negative (mempool/conflicting) heights with endBlock alone, since the range has no lower bound', async () => {
    const rows = await streamRows(walletA, { endBlock: '103' });
    expectRows(rows, expectedA(), [T1, T2, T3, T4, T9, T7, T8]);
  });

  it('ignores includeMempool when no block range is given', async () => {
    const rows = await streamRows(walletA, { includeMempool: 'true' });
    expectRows(rows, expectedA(), allA);
  });

  it('filters by startDate (inclusive) and endDate (exclusive)', async () => {
    const rows = await streamRows(walletA, { startDate: T3.blockTimeNormalized.toISOString(), endDate: T6.blockTimeNormalized.toISOString() });
    expectRows(rows, expectedA(), [T3, T4, T5]);
  });

  it('filters by startDate alone, including later mempool and conflicting txs', async () => {
    const rows = await streamRows(walletA, { startDate: T6.blockTimeNormalized.toISOString() });
    expectRows(rows, expectedA(), [T6, T9, T7, T8]);
  });

  it('ignores invalid dates', async () => {
    const rows = await streamRows(walletA, { startDate: 'not-a-date', endDate: 'also-not-a-date' });
    expectRows(rows, expectedA(), allA);
  });

  it('uses the wallet\'s own network for BTC testnet3 and testnet4 wallets', async () => {
    expectRows(await streamRows(walletTestnet3, {}, 'testnet'), { [TT3.txid]: [outputRow(TT3, 'receive', 0, 'tb1qtestnet3address', 4200)] }, [TT3]);
    expectRows(await streamRows(walletTestnet4, {}, 'testnet'), { [TT4.txid]: [outputRow(TT4, 'receive', 0, 'tb1qtestnet4address', 4300)] }, [TT4]);
  });

  it('does not apply the network override to other wallets', async () => {
    expect(await streamRows(walletA, {}, 'testnet')).to.deep.equal([]);
  });

  it('returns nothing for a wallet with no txs', async () => {
    expect(await streamRows(newWallet(), {})).to.deep.equal([]);
  });
});
