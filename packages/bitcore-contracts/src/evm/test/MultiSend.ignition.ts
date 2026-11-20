import { expect } from 'chai';
import { network } from 'hardhat';
import MultiSendModule from '../ignition/modules/MultiSend';
import MultiSendAcceptAdminModule from '../ignition/modules/MultiSendAcceptAdmin';
import MultiSendSetNewAdminModule from '../ignition/modules/MultiSendSetNewAdmin';

const { ethers, ignition } = await network.create();
const { ZeroAddress } = ethers;

describe('MultiSend ignition modules', function() {
  it('MultiSendModule deploys with the deployer as admin', async function() {
    const [deployer] = await ethers.getSigners();
    const { multiSend } = await ignition.deploy(MultiSendModule);

    expect(await multiSend.admin()).to.equal(deployer.address);
    expect(await multiSend.pendingAdmin()).to.equal(ZeroAddress);
  });

  it('MultiSendSetNewAdminModule starts the admin handover on an existing deployment', async function() {
    const [deployer, newAdmin] = await ethers.getSigners();
    const deployed = await ethers.deployContract('MultiSend', deployer);
    const multiSendAddress = await deployed.getAddress();

    const { multiSend } = await ignition.deploy(MultiSendSetNewAdminModule, {
      parameters: { MultiSendSetNewAdminModule: { multiSendAddress, newAdmin: newAdmin.address } }
    });

    expect(await multiSend.getAddress()).to.equal(multiSendAddress);
    expect(await multiSend.admin()).to.equal(deployer.address);
    expect(await multiSend.pendingAdmin()).to.equal(newAdmin.address);
  });

  it('MultiSendAcceptAdminModule completes the handover when sent by the pending admin', async function() {
    const [deployer, newAdmin] = await ethers.getSigners();
    const deployed = await ethers.deployContract('MultiSend', deployer);
    const multiSendAddress = await deployed.getAddress();

    await ignition.deploy(MultiSendSetNewAdminModule, {
      parameters: { MultiSendSetNewAdminModule: { multiSendAddress, newAdmin: newAdmin.address } }
    });
    const { multiSend } = await ignition.deploy(MultiSendAcceptAdminModule, {
      parameters: { MultiSendAcceptAdminModule: { multiSendAddress } },
      defaultSender: newAdmin.address
    });

    expect(await multiSend.getAddress()).to.equal(multiSendAddress);
    expect(await multiSend.admin()).to.equal(newAdmin.address);
    expect(await multiSend.pendingAdmin()).to.equal(ZeroAddress);
  });

  it('MultiSendAcceptAdminModule fails when not sent by the pending admin', async function() {
    const [deployer, newAdmin, notPending] = await ethers.getSigners();
    const deployed = await ethers.deployContract('MultiSend', deployer);
    const multiSendAddress = await deployed.getAddress();
    await deployed.transferAdmin(newAdmin.address);

    let error: Error | undefined;
    try {
      await ignition.deploy(MultiSendAcceptAdminModule, {
        parameters: { MultiSendAcceptAdminModule: { multiSendAddress } },
        defaultSender: notPending.address
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.match(/Must be the pending admin/);
    expect(await deployed.admin()).to.equal(deployer.address);
    expect(await deployed.pendingAdmin()).to.equal(newAdmin.address);
  });

  it('MultiSendSetNewAdminModule fails when not sent by the current admin', async function() {
    const [deployer, newAdmin, notAdmin] = await ethers.getSigners();
    const deployed = await ethers.deployContract('MultiSend', deployer);
    const multiSendAddress = await deployed.getAddress();

    let error: Error | undefined;
    try {
      await ignition.deploy(MultiSendSetNewAdminModule, {
        parameters: { MultiSendSetNewAdminModule: { multiSendAddress, newAdmin: newAdmin.address } },
        defaultSender: notAdmin.address
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.match(/Must be the admin/);
    expect(await deployed.pendingAdmin()).to.equal(ZeroAddress);
  });
});
