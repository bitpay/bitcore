import { expect } from 'chai';
import { Wallet } from '../../src/wallet';

describe('Wallet ARC support', function() {
  it('should treat ARC as an EVM chain', function() {
    const arcWallet = Object.assign(Object.create(Wallet.prototype), { chain: 'ARC' }) as Wallet;
    expect(arcWallet.isEvmChain()).to.equal(true);
    expect(arcWallet.getLib()).to.have.keys(['Web3', 'ethers']);
  });
});
