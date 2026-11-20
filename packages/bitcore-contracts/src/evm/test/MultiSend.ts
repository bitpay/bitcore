import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers, networkHelpers } = await network.create();
const { ZeroAddress, MaxUint256, parseEther } = ethers;

const ARITHMETIC_OVERFLOW = 0x11;
const REENTRANCY_ERROR = 'Reentrancy Guard: Reentrant call detected!';

/** Decodes a captured `Error(string)` revert payload into its reason string. */
function decodeRevertReason(data: string): string {
  expect(data.slice(0, 10)).to.equal('0x08c379a0'); // Error(string) selector
  return ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + data.slice(10))[0];
}

async function deployFixture() {
  const [admin, alice, bob, carol, dave, mallory] = await ethers.getSigners();

  const multiSend = await ethers.deployContract('MultiSend', admin);
  const token = await ethers.deployContract('MockERC20');
  const token2 = await ethers.deployContract('MockERC20');
  const noReturnToken = await ethers.deployContract('MockNoReturnERC20');
  const falseToken = await ethers.deployContract('MockFalseERC20');

  const multiSendAddress = await multiSend.getAddress();
  for (const t of [token, token2, noReturnToken]) {
    await t.mint(alice.address, parseEther('1000'));
    await t.connect(alice).approve(multiSendAddress, MaxUint256);
  }

  return { multiSend, multiSendAddress, token, token2, noReturnToken, falseToken, admin, alice, bob, carol, dave, mallory };
}

describe('MultiSend', function() {
  describe('deployment', function() {
    it('sets the deployer as admin with no pending admin', async function() {
      const { multiSend, admin } = await networkHelpers.loadFixture(deployFixture);
      expect(await multiSend.admin()).to.equal(admin.address);
      expect(await multiSend.pendingAdmin()).to.equal(ZeroAddress);
    });

    it('emits AdminTransferred from the zero address', async function() {
      const [admin] = await ethers.getSigners();
      const multiSend = await ethers.deployContract('MultiSend', admin);
      await expect(multiSend.deploymentTransaction())
        .to.emit(multiSend, 'AdminTransferred')
        .withArgs(ZeroAddress, admin.address);
    });

    it('rejects plain ETH transfers (no receive/fallback)', async function() {
      const { multiSendAddress, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(alice.sendTransaction({ to: multiSendAddress, value: 1n }))
        .to.be.revertedWithoutReason(ethers);
    });
  });

  describe('admin handover', function() {
    it('only the admin can start a transfer', async function() {
      const { multiSend, mallory } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(mallory).transferAdmin(mallory.address))
        .to.be.revertedWith('Must be the admin');
    });

    it('rejects the zero address as new admin', async function() {
      const { multiSend } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.transferAdmin(ZeroAddress))
        .to.be.revertedWith('New admin cannot be the zero address');
    });

    it('is two-step: transferAdmin sets pending, acceptAdmin completes it', async function() {
      const { multiSend, admin, bob } = await networkHelpers.loadFixture(deployFixture);

      await expect(multiSend.transferAdmin(bob.address))
        .to.emit(multiSend, 'AdminTransferStarted')
        .withArgs(admin.address, bob.address);
      expect(await multiSend.admin()).to.equal(admin.address);
      expect(await multiSend.pendingAdmin()).to.equal(bob.address);

      await expect(multiSend.connect(bob).acceptAdmin())
        .to.emit(multiSend, 'AdminTransferred')
        .withArgs(admin.address, bob.address);
      expect(await multiSend.admin()).to.equal(bob.address);
      expect(await multiSend.pendingAdmin()).to.equal(ZeroAddress);

      // Old admin has lost its privileges
      await expect(multiSend.connect(admin).transferAdmin(admin.address))
        .to.be.revertedWith('Must be the admin');
    });

    it('only the pending admin can accept', async function() {
      const { multiSend, bob, mallory } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(bob).acceptAdmin()).to.be.revertedWith('Must be the pending admin');

      await multiSend.transferAdmin(bob.address);
      await expect(multiSend.connect(mallory).acceptAdmin()).to.be.revertedWith('Must be the pending admin');
    });

    it('a new transferAdmin replaces the previous pending admin', async function() {
      const { multiSend, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      await multiSend.transferAdmin(bob.address);
      await multiSend.transferAdmin(carol.address);

      await expect(multiSend.connect(bob).acceptAdmin()).to.be.revertedWith('Must be the pending admin');
      await multiSend.connect(carol).acceptAdmin();
      expect(await multiSend.admin()).to.equal(carol.address);
    });
  });

  describe('sendEth', function() {
    it('sends ETH to each recipient and emits a Transfer per leg', async function() {
      const { multiSend, multiSendAddress, alice, bob, carol, dave } = await networkHelpers.loadFixture(deployFixture);
      const amounts = [parseEther('1'), parseEther('2'), parseEther('3')];
      const recipients = [bob.address, carol.address, dave.address];

      const tx = multiSend.connect(alice).sendEth(recipients, amounts, { value: parseEther('6') });
      await expect(tx).to.changeEtherBalances(ethers, [alice, bob, carol, dave], [-parseEther('6'), ...amounts]);
      for (let i = 0; i < recipients.length; i++) {
        await expect(tx).to.emit(multiSend, 'Transfer').withArgs(alice.address, recipients[i], ZeroAddress, amounts[i]);
      }
      expect(await ethers.provider.getBalance(multiSendAddress)).to.equal(0n);
    });

    it('allows the same recipient more than once', async function() {
      const { multiSend, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([bob.address, bob.address], [1n, 2n], { value: 3n }))
        .to.changeEtherBalance(ethers, bob, 3n);
    });

    it('accepts an empty batch with zero value', async function() {
      const { multiSend, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([], [], { value: 0n })).not.to.revert(ethers);
    });

    it('reverts when array lengths differ', async function() {
      const { multiSend, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([bob.address, carol.address], [1n], { value: 1n }))
        .to.be.revertedWith('Recipients array must have same length as amounts');
    });

    it('reverts when msg.value is more than the sum (nothing left behind)', async function() {
      const { multiSend, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([bob.address], [1n], { value: 2n }))
        .to.be.revertedWith('\'value\' must equal the sum of amounts');
    });

    it('reverts when msg.value is less than the sum', async function() {
      const { multiSend, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([bob.address], [2n], { value: 1n }))
        .to.be.revertedWith('\'value\' must equal the sum of amounts');
    });

    it('reverts on amount overflow', async function() {
      const { multiSend, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([bob.address, carol.address], [MaxUint256, 1n], { value: 0n }))
        .to.be.revertedWithPanic(ARITHMETIC_OVERFLOW);
    });

    it('rejects the zero address as a recipient', async function() {
      const { multiSend, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([ZeroAddress], [1n], { value: 1n }))
        .to.be.revertedWith('Recipient cannot be the zero address');
    });

    it('rejects the contract itself as a recipient', async function() {
      const { multiSend, multiSendAddress, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendEth([multiSendAddress], [1n], { value: 1n }))
        .to.be.revertedWith('Recipient cannot be this contract');
    });

    it('reverts the whole batch if any recipient rejects ETH', async function() {
      const { multiSend, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const rejecter = await ethers.deployContract('RevertingReceiver');
      const bobBefore = await ethers.provider.getBalance(bob.address);

      await expect(multiSend.connect(alice).sendEth([bob.address, await rejecter.getAddress()], [1n, 1n], { value: 2n }))
        .to.be.revertedWith('Failed to send');
      expect(await ethers.provider.getBalance(bob.address)).to.equal(bobBefore);
    });

    it('blocks a recipient from reentering sendEth', async function() {
      const { multiSend, multiSendAddress, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const attacker = await ethers.deployContract('ReentrantReceiver');
      await attacker.setAttack(multiSendAddress, multiSend.interface.encodeFunctionData('sendEth', [[bob.address], [0n]]));

      await multiSend.connect(alice).sendEth([await attacker.getAddress()], [1n], { value: 1n });

      expect(await attacker.attempted()).to.equal(true);
      expect(await attacker.lastSuccess()).to.equal(false);
      expect(decodeRevertReason(await attacker.lastReturnData())).to.equal(REENTRANCY_ERROR);
    });
  });

  describe('sendErc20', function() {
    it('moves tokens straight from the caller to each recipient', async function() {
      const { multiSend, multiSendAddress, token, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      const amounts = [100n, 250n];

      const tx = multiSend.connect(alice).sendErc20(tokenAddress, [bob.address, carol.address], amounts);
      await expect(tx).to.changeTokenBalances(ethers, token, [alice, bob, carol], [-350n, 100n, 250n]);
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(alice.address, bob.address, tokenAddress, 100n);
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(alice.address, carol.address, tokenAddress, 250n);
      expect(await token.balanceOf(multiSendAddress)).to.equal(0n);
    });

    it('works with tokens that return nothing (USDT-style)', async function() {
      const { multiSend, noReturnToken, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      await multiSend.connect(alice).sendErc20(await noReturnToken.getAddress(), [bob.address, carol.address], [5n, 7n]);
      expect(await noReturnToken.balanceOf(bob.address)).to.equal(5n);
      expect(await noReturnToken.balanceOf(carol.address)).to.equal(7n);
    });

    it('reverts when the token returns false', async function() {
      const { multiSend, falseToken, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendErc20(await falseToken.getAddress(), [bob.address], [1n]))
        .to.be.revertedWith('Failed to transfer');
    });

    it('reverts when the token reverts (insufficient allowance)', async function() {
      const { multiSend, token, multiSendAddress, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await token.connect(alice).approve(multiSendAddress, 10n);
      await expect(multiSend.connect(alice).sendErc20(await token.getAddress(), [bob.address, bob.address], [10n, 1n]))
        .to.be.revertedWith('Failed to transfer');
      expect(await token.balanceOf(bob.address)).to.equal(0n);
    });

    it('always pulls from msg.sender, never from someone else\'s allowance', async function() {
      const { multiSend, token, alice, mallory } = await networkHelpers.loadFixture(deployFixture);
      // alice has approved MultiSend for MaxUint256; mallory has no tokens of her own
      await expect(multiSend.connect(mallory).sendErc20(await token.getAddress(), [mallory.address], [1n]))
        .to.be.revertedWith('Failed to transfer');
      expect(await token.balanceOf(alice.address)).to.equal(parseEther('1000'));
    });

    it('rejects a token address with no code', async function() {
      const { multiSend, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendErc20(carol.address, [bob.address], [1n]))
        .to.be.revertedWith('Token is not a contract');
    });

    it('reverts when array lengths differ', async function() {
      const { multiSend, token, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).sendErc20(await token.getAddress(), [bob.address], [1n, 2n]))
        .to.be.revertedWith('Recipients array must have same length as amounts');
    });

    it('rejects the zero address and the contract itself as recipients', async function() {
      const { multiSend, multiSendAddress, token, alice } = await networkHelpers.loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await expect(multiSend.connect(alice).sendErc20(tokenAddress, [ZeroAddress], [1n]))
        .to.be.revertedWith('Recipient cannot be the zero address');
      await expect(multiSend.connect(alice).sendErc20(tokenAddress, [multiSendAddress], [1n]))
        .to.be.revertedWith('Recipient cannot be this contract');
    });

    it('is not payable', async function() {
      const { multiSend, token, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const data = multiSend.interface.encodeFunctionData('sendErc20', [await token.getAddress(), [bob.address], [1n]]);
      await expect(alice.sendTransaction({ to: await multiSend.getAddress(), data, value: 1n }))
        .to.be.revertedWithoutReason(ethers);
    });
  });

  describe('send (combined batches)', function() {
    it('sends ETH and multiple tokens in one transaction', async function() {
      const { multiSend, multiSendAddress, token, token2, alice, bob, carol, dave } = await networkHelpers.loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      const token2Address = await token2.getAddress();
      const batches = [
        { token: ZeroAddress, items: [{ to: bob.address, amount: parseEther('1') }, { to: carol.address, amount: parseEther('2') }] },
        { token: tokenAddress, items: [{ to: carol.address, amount: 30n }] },
        { token: token2Address, items: [{ to: dave.address, amount: 40n }, { to: bob.address, amount: 50n }] }
      ];

      const tx = multiSend.connect(alice).send(batches, { value: parseEther('3') });
      await expect(tx).to.changeEtherBalances(ethers, [alice, bob, carol], [-parseEther('3'), parseEther('1'), parseEther('2')]);
      await expect(tx).to.changeTokenBalances(ethers, token, [alice, carol], [-30n, 30n]);
      await expect(tx).to.changeTokenBalances(ethers, token2, [alice, dave, bob], [-90n, 40n, 50n]);
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(alice.address, bob.address, ZeroAddress, parseEther('1'));
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(alice.address, carol.address, tokenAddress, 30n);
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(alice.address, dave.address, token2Address, 40n);

      expect(await ethers.provider.getBalance(multiSendAddress)).to.equal(0n);
      expect(await token.balanceOf(multiSendAddress)).to.equal(0n);
      expect(await token2.balanceOf(multiSendAddress)).to.equal(0n);
    });

    it('sums ETH across multiple ETH groups', async function() {
      const { multiSend, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      const batches = [
        { token: ZeroAddress, items: [{ to: bob.address, amount: 1n }] },
        { token: ZeroAddress, items: [{ to: carol.address, amount: 2n }] }
      ];
      await expect(multiSend.connect(alice).send(batches, { value: 3n }))
        .to.changeEtherBalances(ethers, [bob, carol], [1n, 2n]);
      await expect(multiSend.connect(alice).send(batches, { value: 2n }))
        .to.be.revertedWith('\'value\' must equal the sum of ETH amounts');
    });

    it('requires msg.value of 0 when only tokens are sent', async function() {
      const { multiSend, token, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const batches = [{ token: await token.getAddress(), items: [{ to: bob.address, amount: 1n }] }];

      await expect(multiSend.connect(alice).send(batches, { value: 1n }))
        .to.be.revertedWith('\'value\' must equal the sum of ETH amounts');
      await expect(multiSend.connect(alice).send(batches))
        .to.changeTokenBalance(ethers, token, bob, 1n);
    });

    it('accepts an empty batch list with zero value', async function() {
      const { multiSend, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(alice).send([])).not.to.revert(ethers);
    });

    it('reverts on ETH amount overflow', async function() {
      const { multiSend, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const batches = [{ token: ZeroAddress, items: [{ to: bob.address, amount: MaxUint256 }, { to: bob.address, amount: 1n }] }];
      await expect(multiSend.connect(alice).send(batches)).to.be.revertedWithPanic(ARITHMETIC_OVERFLOW);
    });

    it('is all-or-nothing: a failing token leg reverts the ETH legs too', async function() {
      const { multiSend, token, multiSendAddress, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      await token.connect(alice).approve(multiSendAddress, 0n);
      const bobBefore = await ethers.provider.getBalance(bob.address);
      const batches = [
        { token: ZeroAddress, items: [{ to: bob.address, amount: 1n }] },
        { token: await token.getAddress(), items: [{ to: carol.address, amount: 1n }] }
      ];

      await expect(multiSend.connect(alice).send(batches, { value: 1n })).to.be.revertedWith('Failed to transfer');
      expect(await ethers.provider.getBalance(bob.address)).to.equal(bobBefore);
    });

    it('rejects a token group whose address has no code', async function() {
      const { multiSend, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      const batches = [{ token: carol.address, items: [{ to: bob.address, amount: 1n }] }];
      await expect(multiSend.connect(alice).send(batches)).to.be.revertedWith('Token is not a contract');
    });

    it('rejects invalid recipients in both ETH and token groups', async function() {
      const { multiSend, multiSendAddress, token, alice } = await networkHelpers.loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();

      await expect(multiSend.connect(alice).send([{ token: ZeroAddress, items: [{ to: ZeroAddress, amount: 1n }] }], { value: 1n }))
        .to.be.revertedWith('Recipient cannot be the zero address');
      await expect(multiSend.connect(alice).send([{ token: ZeroAddress, items: [{ to: multiSendAddress, amount: 1n }] }], { value: 1n }))
        .to.be.revertedWith('Recipient cannot be this contract');
      await expect(multiSend.connect(alice).send([{ token: tokenAddress, items: [{ to: ZeroAddress, amount: 1n }] }]))
        .to.be.revertedWith('Recipient cannot be the zero address');
      await expect(multiSend.connect(alice).send([{ token: tokenAddress, items: [{ to: multiSendAddress, amount: 1n }] }]))
        .to.be.revertedWith('Recipient cannot be this contract');
    });

    it('blocks a recipient from reentering send', async function() {
      const { multiSend, multiSendAddress, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const attacker = await ethers.deployContract('ReentrantReceiver');
      await attacker.setAttack(multiSendAddress, multiSend.interface.encodeFunctionData('send', [[{ token: ZeroAddress, items: [{ to: bob.address, amount: 0n }] }]]));

      await multiSend.connect(alice).send([{ token: ZeroAddress, items: [{ to: await attacker.getAddress(), amount: 1n }] }], { value: 1n });

      expect(await attacker.attempted()).to.equal(true);
      expect(await attacker.lastSuccess()).to.equal(false);
      expect(decodeRevertReason(await attacker.lastReturnData())).to.equal(REENTRANCY_ERROR);
    });
  });

  describe('withdrawEth', function() {
    it('lets the admin withdraw force-sent ETH', async function() {
      const { multiSend, multiSendAddress, admin, bob } = await networkHelpers.loadFixture(deployFixture);
      await networkHelpers.setBalance(multiSendAddress, parseEther('5'));

      const tx = multiSend.connect(admin).withdrawEth(bob.address, parseEther('2'));
      await expect(tx).to.changeEtherBalances(ethers, [multiSendAddress, bob], [-parseEther('2'), parseEther('2')]);
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(multiSendAddress, bob.address, ZeroAddress, parseEther('2'));
    });

    it('only the admin can withdraw', async function() {
      const { multiSend, multiSendAddress, mallory } = await networkHelpers.loadFixture(deployFixture);
      await networkHelpers.setBalance(multiSendAddress, parseEther('5'));
      await expect(multiSend.connect(mallory).withdrawEth(mallory.address, 1n)).to.be.revertedWith('Must be the admin');
    });

    it('cannot withdraw more than the balance', async function() {
      const { multiSend, multiSendAddress, bob } = await networkHelpers.loadFixture(deployFixture);
      await networkHelpers.setBalance(multiSendAddress, 10n);
      await expect(multiSend.withdrawEth(bob.address, 11n))
        .to.be.revertedWith('Attempting to withdraw more ETH than available');
    });

    it('rejects the zero address and the contract itself as recipients', async function() {
      const { multiSend, multiSendAddress } = await networkHelpers.loadFixture(deployFixture);
      await networkHelpers.setBalance(multiSendAddress, 10n);
      await expect(multiSend.withdrawEth(ZeroAddress, 1n)).to.be.revertedWith('Recipient cannot be the zero address');
      await expect(multiSend.withdrawEth(multiSendAddress, 1n)).to.be.revertedWith('Recipient cannot be this contract');
    });

    it('an admin that is also a sendEth recipient cannot reenter to grab in-flight ETH', async function() {
      const { multiSend, multiSendAddress, alice } = await networkHelpers.loadFixture(deployFixture);
      const attacker = await ethers.deployContract('ReentrantReceiver');
      const attackerAddress = await attacker.getAddress();

      // Make the attacker contract the admin
      await multiSend.transferAdmin(attackerAddress);
      await attacker.execute(multiSendAddress, multiSend.interface.encodeFunctionData('acceptAdmin'));
      expect(await multiSend.admin()).to.equal(attackerAddress);

      // alice sends 1 ETH to the attacker and 4 ETH to herself; mid-batch the contract still holds 4 ETH
      await attacker.setAttack(multiSendAddress, multiSend.interface.encodeFunctionData('withdrawEth', [attackerAddress, parseEther('4')]));
      await expect(multiSend.connect(alice).sendEth([attackerAddress, alice.address], [parseEther('1'), parseEther('4')], { value: parseEther('5') }))
        .to.changeEtherBalances(ethers, [alice, attackerAddress], [-parseEther('1'), parseEther('1')]);

      expect(await attacker.attempted()).to.equal(true);
      expect(await attacker.lastSuccess()).to.equal(false);
      expect(decodeRevertReason(await attacker.lastReturnData())).to.equal(REENTRANCY_ERROR);
      expect(await ethers.provider.getBalance(multiSendAddress)).to.equal(0n);
    });
  });

  describe('withdrawErc20', function() {
    it('lets the admin withdraw tokens sent directly to the contract', async function() {
      const { multiSend, multiSendAddress, token, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await token.connect(alice).transfer(multiSendAddress, 100n);

      const tx = multiSend.withdrawErc20(tokenAddress, bob.address, 60n);
      await expect(tx).to.changeTokenBalances(ethers, token, [multiSendAddress, bob], [-60n, 60n]);
      await expect(tx).to.emit(multiSend, 'Transfer').withArgs(multiSendAddress, bob.address, tokenAddress, 60n);
    });

    it('works with tokens that return nothing (USDT-style)', async function() {
      const { multiSend, multiSendAddress, noReturnToken, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await noReturnToken.connect(alice).transfer(multiSendAddress, 10n);
      await multiSend.withdrawErc20(await noReturnToken.getAddress(), bob.address, 10n);
      expect(await noReturnToken.balanceOf(bob.address)).to.equal(10n);
    });

    it('reverts when the token returns false or reverts', async function() {
      const { multiSend, falseToken, token, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.withdrawErc20(await falseToken.getAddress(), bob.address, 1n))
        .to.be.revertedWith('Failed to transfer');
      // contract holds none of `token`
      await expect(multiSend.withdrawErc20(await token.getAddress(), bob.address, 1n))
        .to.be.revertedWith('Failed to transfer');
    });

    it('only the admin can withdraw', async function() {
      const { multiSend, token, mallory } = await networkHelpers.loadFixture(deployFixture);
      await expect(multiSend.connect(mallory).withdrawErc20(await token.getAddress(), mallory.address, 1n))
        .to.be.revertedWith('Must be the admin');
    });

    it('rejects a token address with no code and invalid recipients', async function() {
      const { multiSend, multiSendAddress, token, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await expect(multiSend.withdrawErc20(carol.address, bob.address, 1n)).to.be.revertedWith('Token is not a contract');
      await expect(multiSend.withdrawErc20(tokenAddress, ZeroAddress, 1n)).to.be.revertedWith('Recipient cannot be the zero address');
      await expect(multiSend.withdrawErc20(tokenAddress, multiSendAddress, 1n)).to.be.revertedWith('Recipient cannot be this contract');
    });
  });
});
