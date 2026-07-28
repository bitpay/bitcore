import { expect } from 'chai';
import { WalletStatsWalletStorage } from '../../../src/models/walletStatsWallet';

describe('WalletStatsWallet Model', function() {
  it('classifies activity windows from a last-activity date', () => {
    const asOf = new Date('2026-08-03T00:00:00Z');
    const win = (daysAgo: number) => new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    expect(WalletStatsWalletStorage.activityWindow(win(7), asOf)).to.equal('d14');
    expect(WalletStatsWalletStorage.activityWindow(win(20), asOf)).to.equal('d30');
    expect(WalletStatsWalletStorage.activityWindow(win(60), asOf)).to.equal('d90');
    expect(WalletStatsWalletStorage.activityWindow(win(120), asOf)).to.equal('m6');
    expect(WalletStatsWalletStorage.activityWindow(win(300), asOf)).to.equal('m12');
    expect(WalletStatsWalletStorage.activityWindow(win(400), asOf)).to.equal(null);
    expect(WalletStatsWalletStorage.activityWindow(null, asOf)).to.equal(null);
  });
});
