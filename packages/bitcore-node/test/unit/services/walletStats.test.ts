import { expect } from 'chai';
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
});
