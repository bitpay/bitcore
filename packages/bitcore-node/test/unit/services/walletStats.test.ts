import { expect } from 'chai';
import { ObjectID } from 'mongodb';
import * as sinon from 'sinon';
import { WalletStatsService } from '../../../src/services/walletStats';

describe('WalletStats Service', function() {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  describe('snapshotDateIfDue', () => {
    // Config default: snapshotDayUTC 1 (Monday), snapshotHourUTC 2
    it('returns the current-week snapshot date when past the scheduled time and not yet taken', () => {
      const svc = new WalletStatsService();
      // Wed Aug 5 2026, watermark is the prior week
      const due = svc.snapshotDateIfDue(new Date('2026-08-05T12:00:00Z'), '2026-07-27');
      expect(due).to.equal('2026-08-03'); // Monday of the current week
    });

    it('returns null when the current week is already snapshotted', () => {
      const svc = new WalletStatsService();
      const due = svc.snapshotDateIfDue(new Date('2026-08-05T12:00:00Z'), '2026-08-03');
      expect(due).to.equal(null);
    });

    it('returns null before the scheduled hour on snapshot day', () => {
      const svc = new WalletStatsService();
      const due = svc.snapshotDateIfDue(new Date('2026-08-03T01:00:00Z'), '2026-07-27');
      expect(due).to.equal(null);
    });

    it('returns the current-week date when there is no watermark at all', () => {
      const svc = new WalletStatsService();
      const due = svc.snapshotDateIfDue(new Date('2026-08-05T12:00:00Z'), null);
      expect(due).to.equal('2026-08-03');
    });
  });

  describe('missedSnapshotDates', () => {
    it('lists weekly dates between the watermark and now', () => {
      const svc = new WalletStatsService();
      const missed = svc.missedSnapshotDates(new Date('2026-08-05T12:00:00Z'), '2026-07-13');
      expect(missed).to.deep.equal(['2026-07-20', '2026-07-27', '2026-08-03']);
    });
  });

  describe('collectUtxoBalances', () => {
    it('maps a coins aggregation into per-wallet balances', async () => {
      const rows = [
        { _id: 'a'.repeat(24), balance: 5000 },
        { _id: 'b'.repeat(24), balance: 0 }
      ];
      const aggregate = sandbox.stub().returns({ toArray: async () => rows });
      const coinModel: any = { collection: { aggregate } };
      const svc = new WalletStatsService({ coinModel } as any);
      const balances = await svc.collectUtxoBalances({ chain: 'BTC', network: 'mainnet' });
      expect(balances.get('a'.repeat(24))).to.equal(5000n);
      expect(balances.get('b'.repeat(24))).to.equal(0n);
      // Pin the unspent/valid-mint predicate and the index hint so a typo can't pass.
      const [pipeline, options] = aggregate.firstCall.args;
      expect(pipeline[0].$match.spentHeight).to.deep.equal({ $lt: 0 }); // SpentHeightIndicators.minimum
      expect(pipeline[0].$match.mintHeight).to.deep.equal({ $gt: -3 }); // SpentHeightIndicators.conflicting
      expect(options.hint).to.deep.equal({ wallets: 1, spentHeight: 1, value: 1, mintHeight: 1 });
    });
  });

  describe('collectUtxoActivity', () => {
    // Chainable cursor stub: find().project().sort().limit().toArray() all resolve to `rows`.
    const cursor = (rows: any[]) => {
      const c: any = {};
      c.project = () => c;
      c.sort = () => c;
      c.limit = () => c;
      c.toArray = async () => rows;
      return c;
    };

    // Route block queries by shape: the sinceHeight lookup filters on timeNormalized,
    // the height->date range scan filters on height.
    const routeBlockFind = (sinceRows: any[], rangeRows: any[]) =>
      sandbox.stub().callsFake((q: any) => {
        if ('timeNormalized' in q) return cursor(sinceRows);
        if ('height' in q) return cursor(rangeRows);
        return cursor([]);
      });

    it('maps mint/spend block heights into per-wallet last activity', async () => {
      const since = new Date('2025-08-03T00:00:00Z');
      const activityDate = new Date('2026-07-30T00:00:00Z');
      const blockFind = routeBlockFind([{ height: 100 }], [{ height: 500, timeNormalized: activityDate }]);
      const blockModel: any = { collection: { find: blockFind } };
      const coinModel: any = {
        collection: { aggregate: sandbox.stub().returns({ toArray: async () => [{ _id: 'a'.repeat(24), maxHeight: 500 }] }) }
      };
      const svc = new WalletStatsService({ coinModel, blockModel } as any);
      const activity = await svc.collectUtxoActivity({ chain: 'BTC', network: 'mainnet', since });
      expect(activity.get('a'.repeat(24))).to.deep.equal(activityDate);
    });

    it('ignores unconfirmed sentinel heights and skips the block range scan', async () => {
      const since = new Date('2025-08-03T00:00:00Z');
      const blockFind = routeBlockFind([{ height: 100 }], [{ height: 500, timeNormalized: new Date() }]);
      const blockModel: any = { collection: { find: blockFind } };
      const coinModel: any = {
        collection: { aggregate: sandbox.stub().returns({ toArray: async () => [{ _id: 'c'.repeat(24), maxHeight: -1 }] }) }
      };
      const svc = new WalletStatsService({ coinModel, blockModel } as any);
      const activity = await svc.collectUtxoActivity({ chain: 'BTC', network: 'mainnet', since });
      expect(activity.has('c'.repeat(24))).to.equal(false);
      // Only the sinceHeight lookup runs; nothing confirmed to resolve, so no range scan.
      expect(blockFind.calledOnce).to.equal(true);
    });
  });

  describe('buildSnapshot', () => {
    it('rolls per-wallet facts up into snapshot counters', () => {
      const svc = new WalletStatsService({} as any);
      const date = '2026-08-03';
      const oid = (c: string) => new ObjectID(c.repeat(24).slice(0, 24));
      const wallets = [
        { _id: oid('a'), chain: 'BTC', network: 'mainnet' },
        { _id: oid('b'), chain: 'BTC', network: 'mainnet' },
        { _id: oid('c'), chain: 'BTC', network: 'mainnet' }
      ];
      const balances = new Map([[oid('a').toHexString(), 5000n], [oid('b').toHexString(), 0n]]);
      const activity = new Map([[oid('a').toHexString(), new Date('2026-07-27')], [oid('b').toHexString(), new Date('2026-06-04')]]);
      const { snapshot, walletFacts } = svc.buildSnapshot({ chain: 'BTC', network: 'mainnet', date, wallets, balances, activity, dups: new Set<string>() });
      expect(snapshot.walletCntTotal).to.equal('3');
      expect(snapshot.walletCntWithBalance).to.equal('1');
      expect(snapshot.totalBalance).to.equal('5000');
      expect(snapshot.active.d14).to.equal('1');
      expect(snapshot.active.d90).to.equal('1');
      expect(walletFacts.length).to.equal(3);
    });

    it('splits wallets into bitcore vs imported by creation date and excludes dups', () => {
      const svc = new WalletStatsService({} as any);
      const date = '2026-08-03';
      const asOfSecs = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
      const before = ObjectID.createFromTime(asOfSecs('2026-07-01T00:00:00Z')); // created before snapshot
      const after = ObjectID.createFromTime(asOfSecs('2026-08-10T00:00:00Z')); // created after snapshot
      const dup = ObjectID.createFromTime(asOfSecs('2026-07-15T00:00:00Z'));
      const wallets = [
        { _id: before, chain: 'BTC', network: 'mainnet' },
        { _id: after, chain: 'BTC', network: 'mainnet' },
        { _id: dup, chain: 'BTC', network: 'mainnet' }
      ];
      const balances = new Map([[before.toHexString(), 1000n], [after.toHexString(), 2000n], [dup.toHexString(), 9000n]]);
      const dups = new Set<string>([dup.toHexString()]);
      const { snapshot, walletFacts } = svc.buildSnapshot({ chain: 'BTC', network: 'mainnet', date, wallets, balances, activity: new Map(), dups });
      expect(snapshot.walletCntTotal).to.equal('2'); // dup excluded
      expect(snapshot.walletCntBitcore).to.equal('1');
      expect(snapshot.walletCntImported).to.equal('1');
      expect(snapshot.totalBalanceImported).to.equal('2000');
      expect(snapshot.totalBalance).to.equal('3000'); // dup's 9000 excluded
      expect(snapshot.dupWalletCnt).to.equal('1');
      expect(walletFacts.length).to.equal(3); // dup still gets a fact
      expect(walletFacts.find(f => f.wallet.equals(dup))!.isDup).to.equal(true);
    });
  });

  describe('collectEvmWalletFact', () => {
    const asOf = new Date('2026-08-03T00:00:00Z');
    const priorDate = new Date('2026-05-01T00:00:00Z');
    const wallet = { _id: new ObjectID(), chain: 'ETH', network: 'mainnet' };
    const twelveMonthsBefore = (d: Date) => {
      const s = new Date(d.getTime());
      s.setUTCFullYear(s.getUTCFullYear() - 1);
      return s;
    };

    it('carries the prior activity date forward when balance and nonce are unchanged', async () => {
      const csp = {
        getBalanceForAddress: sandbox.stub().resolves({ balance: '0x64' }), // 100
        getAccountNonce: sandbox.stub().resolves(5)
      };
      const checkTokenActivity = sandbox.stub().resolves(null);
      const svc = new WalletStatsService({ waitFn: async () => {} } as any);
      const fact = await svc.collectEvmWalletFact({
        csp, wallet, addresses: ['0xabc'],
        prior: { balance: '100', nonce: '5', lastActivityDate: priorDate },
        asOf, checkTokenActivity
      } as any);
      expect(fact.balance).to.equal('100');
      expect(fact.nonce).to.equal('5');
      expect(fact.lastActivityDate).to.deep.equal(priorDate);
      expect(checkTokenActivity.called).to.equal(false);
      // Request hex balances so large wei values keep full precision.
      expect(csp.getBalanceForAddress.firstCall.args[0].args).to.deep.equal({ hex: 'true' });
    });

    it('dates activity to asOf when the nonce changed since the prior snapshot', async () => {
      const csp = {
        getBalanceForAddress: sandbox.stub().resolves({ balance: '0x64' }),
        getAccountNonce: sandbox.stub().resolves(6)
      };
      const checkTokenActivity = sandbox.stub().resolves(null);
      const svc = new WalletStatsService({ waitFn: async () => {} } as any);
      const fact = await svc.collectEvmWalletFact({
        csp, wallet, addresses: ['0xabc'],
        prior: { balance: '100', nonce: '5', lastActivityDate: priorDate },
        asOf, checkTokenActivity
      } as any);
      expect(fact.nonce).to.equal('6');
      expect(fact.lastActivityDate).to.deep.equal(asOf);
      expect(checkTokenActivity.called).to.equal(false);
    });

    it('falls back to a token-activity lookup when a plausibly-active wallet has no prior date', async () => {
      const tokenDate = new Date('2026-06-15T00:00:00Z');
      const csp = {
        getBalanceForAddress: sandbox.stub().resolves({ balance: '0x64' }),
        getAccountNonce: sandbox.stub().resolves(5)
      };
      const checkTokenActivity = sandbox.stub().resolves(tokenDate);
      const svc = new WalletStatsService({ waitFn: async () => {} } as any);
      const fact = await svc.collectEvmWalletFact({
        csp, wallet, addresses: ['0xabc'],
        prior: { balance: '100', nonce: '5' }, // unchanged, but no lastActivityDate on record
        asOf, checkTokenActivity
      } as any);
      expect(fact.lastActivityDate).to.deep.equal(tokenDate);
      expect(checkTokenActivity.calledOnce).to.equal(true);
      expect(checkTokenActivity.firstCall.args[0]).to.deep.equal(['0xabc']);
      expect(checkTokenActivity.firstCall.args[1].getTime()).to.equal(twelveMonthsBefore(asOf).getTime());
    });

    it('still runs the token lookup for a zero-balance wallet on its first-ever snapshot', async () => {
      const csp = {
        getBalanceForAddress: sandbox.stub().resolves({ balance: '0x0' }),
        getAccountNonce: sandbox.stub().resolves(0)
      };
      const checkTokenActivity = sandbox.stub().resolves(null);
      const svc = new WalletStatsService({ waitFn: async () => {} } as any);
      const fact = await svc.collectEvmWalletFact({
        csp, wallet, addresses: ['0xabc'], asOf, checkTokenActivity // no prior
      } as any);
      expect(fact.balance).to.equal('0');
      expect(fact.nonce).to.equal('0');
      expect(fact.lastActivityDate).to.equal(undefined);
      expect(checkTokenActivity.calledOnce).to.equal(true);
    });

    it('retries a rate-limited provider call with backoff', async () => {
      const getBalanceForAddress = sandbox.stub();
      getBalanceForAddress.onFirstCall().rejects(new Error('Too Many Requests'));
      getBalanceForAddress.onSecondCall().resolves({ balance: '0x64' });
      const csp = { getBalanceForAddress, getAccountNonce: sandbox.stub().resolves(5) };
      const checkTokenActivity = sandbox.stub().resolves(null);
      const waitFn = sandbox.stub().resolves();
      const svc = new WalletStatsService({ waitFn } as any);
      const fact = await svc.collectEvmWalletFact({
        csp, wallet, addresses: ['0xabc'],
        prior: { balance: '100', nonce: '5', lastActivityDate: priorDate },
        asOf, checkTokenActivity
      } as any);
      expect(fact.balance).to.equal('100');
      expect(getBalanceForAddress.calledTwice).to.equal(true);
      expect(waitFn.calledOnce).to.equal(true);
    });
  });

  describe('detectDups', () => {
    it('honors the stored verdict for settled wallets without re-querying addresses', async () => {
      const dupId = new ObjectID();
      const cleanId = new ObjectID();
      const aggregate = sandbox.stub().returns({
        toArray: async () => [{ _id: dupId, isDup: true }, { _id: cleanId, isDup: false }]
      });
      const walletStatsWalletModel: any = { collection: { aggregate } };
      const findOne = sandbox.stub();
      const walletAddressModel: any = { collection: { findOne, find: sandbox.stub() } };
      const svc = new WalletStatsService({ walletStatsWalletModel, walletAddressModel } as any);
      const dups = await svc.detectDups({ chain: 'BTC', network: 'mainnet', wallets: [{ _id: dupId }, { _id: cleanId }] });
      expect(dups.has(dupId.toHexString())).to.equal(true);
      expect(dups.has(cleanId.toHexString())).to.equal(false);
      expect(findOne.called).to.equal(false); // settled verdicts skip the address lookups
    });

    it('flags an unsettled cluster of wallets that share a first address', async () => {
      const w1 = new ObjectID();
      const w2 = new ObjectID();
      const aggregate = sandbox.stub().returns({ toArray: async () => [] }); // no prior facts => unsettled
      const walletStatsWalletModel: any = { collection: { aggregate } };
      const findOne = sandbox.stub().resolves({ address: '0xshared', wallet: w1 });
      const find = sandbox.stub().returns({
        toArray: async () => [{ wallet: w1, address: '0xshared' }, { wallet: w2, address: '0xshared' }]
      });
      const walletAddressModel: any = { collection: { findOne, find } };
      const svc = new WalletStatsService({ walletStatsWalletModel, walletAddressModel } as any);
      const dups = await svc.detectDups({ chain: 'BTC', network: 'mainnet', wallets: [{ _id: w1 }, { _id: w2 }] });
      expect(dups.has(w1.toHexString())).to.equal(true);
      expect(dups.has(w2.toHexString())).to.equal(true);
    });

    it('does not flag an unsettled wallet that has no addresses', async () => {
      const w = new ObjectID();
      const aggregate = sandbox.stub().returns({ toArray: async () => [] });
      const walletStatsWalletModel: any = { collection: { aggregate } };
      const findOne = sandbox.stub().resolves(null); // wallet has no address
      const find = sandbox.stub();
      const walletAddressModel: any = { collection: { findOne, find } };
      const svc = new WalletStatsService({ walletStatsWalletModel, walletAddressModel } as any);
      const dups = await svc.detectDups({ chain: 'BTC', network: 'mainnet', wallets: [{ _id: w }] });
      expect(dups.has(w.toHexString())).to.equal(false);
      expect(find.called).to.equal(false); // no first address => no cluster query
    });
  });
});
