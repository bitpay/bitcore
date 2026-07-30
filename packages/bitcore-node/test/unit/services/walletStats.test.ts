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
      const coinModel: any = { collection: { aggregate: sandbox.stub().returns({ toArray: async () => rows }) } };
      const svc = new WalletStatsService({ coinModel } as any);
      const balances = await svc.collectUtxoBalances({ chain: 'BTC', network: 'mainnet' });
      expect(balances.get('a'.repeat(24))).to.equal(5000n);
      expect(balances.get('b'.repeat(24))).to.equal(0n);
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

    it('maps mint/spend block heights into per-wallet last activity', async () => {
      const since = new Date('2025-08-03T00:00:00Z');
      const activityDate = new Date('2026-07-30T00:00:00Z');
      const blockFind = sandbox.stub();
      blockFind.onFirstCall().returns(cursor([{ height: 100 }])); // resolve sinceHeight
      blockFind.onSecondCall().returns(cursor([{ height: 500, timeNormalized: activityDate }])); // heights -> dates
      const blockModel: any = { collection: { find: blockFind } };
      const coinModel: any = {
        collection: { aggregate: sandbox.stub().returns({ toArray: async () => [{ _id: 'a'.repeat(24), maxHeight: 500 }] }) }
      };
      const svc = new WalletStatsService({ coinModel, blockModel } as any);
      const activity = await svc.collectUtxoActivity({ chain: 'BTC', network: 'mainnet', since });
      expect(activity.get('a'.repeat(24))).to.deep.equal(activityDate);
    });

    it('ignores wallets whose only recent activity is an unconfirmed sentinel height', async () => {
      const since = new Date('2025-08-03T00:00:00Z');
      const blockFind = sandbox.stub();
      blockFind.onFirstCall().returns(cursor([{ height: 100 }]));
      blockFind.onSecondCall().returns(cursor([])); // no confirmed heights to resolve
      const blockModel: any = { collection: { find: blockFind } };
      const coinModel: any = {
        collection: { aggregate: sandbox.stub().returns({ toArray: async () => [{ _id: 'c'.repeat(24), maxHeight: -1 }] }) }
      };
      const svc = new WalletStatsService({ coinModel, blockModel } as any);
      const activity = await svc.collectUtxoActivity({ chain: 'BTC', network: 'mainnet', since });
      expect(activity.has('c'.repeat(24))).to.equal(false);
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
});
