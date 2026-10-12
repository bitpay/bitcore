import * as chai from 'chai';
import { Transactions, ethers } from '@bitpay-labs/crypto-wallet-core';

chai.should();

describe('Amount type divergence', function() {
  const exact = '70000000000000008';
  const numeric = Number(exact);
  const evm = {
    network: 'livenet',
    nonce: 5,
    gasPrice: 25000000000,
    gasLimit: 21000,
    recipients: [{ address: '0x1111111111111111111111111111111111111111', amount: exact }]
  };

  it('should read a number as its printed form for native EVM but as its exact value for ERC20', function() {
    numeric.toLocaleString('fullwide', { useGrouping: false }).should.equal('70000000000000010');
    BigInt(numeric).toString().should.equal(exact);

    const native = Transactions.create({ ...evm, chain: 'ETH', recipients: [{ ...evm.recipients[0], amount: numeric }] });
    ethers.Transaction.from(native).value.should.equal(70000000000000010n);

    const token = { ...evm, chain: 'ETHERC20', tokenAddress: '0x2222222222222222222222222222222222222222' };
    Transactions.create({ ...token, recipients: [{ ...evm.recipients[0], amount: numeric }] })
      .should.equal(Transactions.create(token));
  });
});
