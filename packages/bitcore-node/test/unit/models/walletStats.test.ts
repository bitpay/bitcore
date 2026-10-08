import { expect } from 'chai';
import { WalletStatsStorage } from '../../../src/models/walletStats';

describe('WalletStats Model', function() {
  it('has the walletstats collection name', () => {
    expect((WalletStatsStorage as any).collectionName).to.equal('walletstats');
  });

  it('builds an empty snapshot with zeroed counters', () => {
    const snap = WalletStatsStorage.newSnapshot({ chain: 'BTC', network: 'mainnet', date: '2026-08-03' });
    expect(snap.chain).to.equal('BTC');
    expect(snap.walletCntTotal).to.equal('0');
    expect(snap.totalBalance).to.equal('0');
    expect(snap.active.d30).to.equal('0');
  });
});
