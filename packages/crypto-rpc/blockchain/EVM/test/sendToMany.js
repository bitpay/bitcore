import hardhat from 'hardhat';
import assert from 'assert';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

describe('SendToMany', () => {
  let CryptoErc20;
  let SendToMany;
  let accounts;
  const initialEthBalances = [];
  const initialErc20Balances = [];

  before(async function() {
    accounts = (await hardhat.ethers.getSigners()).map(m => m.address);
    CryptoErc20 = await hardhat.ethers.deployContract('CryptoErc20');
    SendToMany = await hardhat.ethers.deployContract('SendToMany');
    for (const account of accounts) {
      initialEthBalances.push(await hardhat.ethers.provider.getBalance(account));
      initialErc20Balances.push(await CryptoErc20.balanceOf(account));
    }
  });

  it('should send ether', async() => {
    const receivers = accounts.slice(1);
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const balanceBefore = await hardhat.ethers.provider.getBalance(accounts[0]);
    // console.log('ETH balance before', balanceBefore.toString());
    const sum = (1e18*receivers.length).toString();
    await SendToMany.sendMany(receivers, amounts, ZERO_ADDR, { value: sum });
    const balanceAfter = await hardhat.ethers.provider.getBalance(accounts[0]);
    // console.log('ETH balance after', balanceAfter.toString());
    assert.ok(balanceBefore - balanceAfter > sum, 'Diff should be >sum because of gas');
    for (let i = 0; i < receivers.length; i++) {
      const receiver = receivers[i];
      const sentAmount = amounts[i];
      const initBalance = initialEthBalances[i+1];
      const nowBalance = await hardhat.ethers.provider.getBalance(receiver);
      const receiptAmt = nowBalance - initBalance;
      // console.log('ETH Balance', receiver, ':', nowBalance.toString());
      assert.strictEqual(receiptAmt.toString(), sentAmount.toString(), `Balance mismatch: ${i} - ${receiptAmt.toString()} != ${sentAmount.toString()}`);
    }
  });

  it('should send tokens', async() => {
    const receivers = accounts.slice(1);
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const sum = (1e18*receivers.length).toString();
    const balanceBefore = await CryptoErc20.balanceOf(accounts[0]);
    // console.log('Token balance before', balanceBefore.toString());
    await CryptoErc20.approve(SendToMany.target, sum);
    await SendToMany.sendMany(receivers, amounts, CryptoErc20.target);
    const balanceAfter = await CryptoErc20.balanceOf(accounts[0]);
    // console.log('Token balance after', balanceAfter.toString());
    assert.ok(balanceBefore - balanceAfter == sum, 'Diff should be =sum because gas is paid in ETH');
    for (let i = 0; i < receivers.length; i++) {
      const receiver = receivers[i];
      const sentAmount = amounts[i];
      const initBalance = initialErc20Balances[i+1];
      const nowBalance = await CryptoErc20.balanceOf(receiver);
      const receiptAmt = nowBalance - initBalance;
      // console.log('Token Balance', receiver, ':', nowBalance.toString());
      assert.strictEqual(receiptAmt.toString(), sentAmount.toString(), `Balance mismatch: ${i} - ${receiptAmt.toString()} != ${sentAmount.toString()}`);
    }
  });

});
