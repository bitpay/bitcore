import { expect } from 'chai';
import { network } from 'hardhat';
import MultiSendModule from '../ignition/modules/MultiSend.ts';
import MultiSendWithAdminModule from '../ignition/modules/MultiSendWithAdmin.ts';

const { ethers, ignition } = await network.create();
const { ZeroAddress } = ethers;

describe('MultiSend ignition modules', function() {
  it('MultiSendModule deploys with the deployer as admin', async function() {
    const [deployer] = await ethers.getSigners();
    const { multiSend } = await ignition.deploy(MultiSendModule);

    expect(await multiSend.admin()).to.equal(deployer.address);
    expect(await multiSend.pendingAdmin()).to.equal(ZeroAddress);
  });

  it('MultiSendWithAdminModule starts the admin handover to newAdmin', async function() {
    const [deployer, newAdmin] = await ethers.getSigners();
    const { multiSend } = await ignition.deploy(MultiSendWithAdminModule, {
      parameters: { MultiSendWithAdminModule: { newAdmin: newAdmin.address } }
    });

    expect(await multiSend.admin()).to.equal(deployer.address);
    expect(await multiSend.pendingAdmin()).to.equal(newAdmin.address);

    await (multiSend.connect(newAdmin) as typeof multiSend).acceptAdmin();
    expect(await multiSend.admin()).to.equal(newAdmin.address);
  });
});
