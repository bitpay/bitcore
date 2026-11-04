import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { Key, TssKey } from '@bitpay-labs/bitcore-wallet-client';
import * as prompt from '@clack/prompts';
import config from './data/test-config';
import * as helpers from './helpers';
import { getCommands } from '../src/cli-commands';
import { createSiblingWallet } from '../src/commands/createsiblingwallet';
import * as promptsModule from '../src/prompts';
import { Wallet } from '../src/wallet';
import type { ICliWalletOptions } from '../types/cli';

describe('Sibling Wallets', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 30000));
  const { BTC, DIR, PASSWORD } = helpers.CONSTANTS.WALLETS;
  const host = `http://localhost:${config.bws.port}`;
  const chain = 'eth';
  const network = 'livenet';
  const walletNames = ['eth-tss0', 'eth-tss1', 'eth-tss2'];
  const sandbox = sinon.createSandbox();
  let tempDir: string;

  const readWalletFile = (name: string) => JSON.parse(fs.readFileSync(path.join(tempDir, name + '.json'), 'utf-8'));
  const walletFileExists = (name: string) => fs.existsSync(path.join(tempDir, name + '.json'));

  const loadWallet = async (name: string, opts: { doNotComplete?: boolean } = {}) => {
    const wallet = new Wallet({ name, dir: tempDir, host });
    sandbox.stub(wallet as any, 'lockLoadedWallet');
    await wallet.getClient({ mustExist: true, ...opts });
    return wallet;
  };

  /** Generate a 2-of-3 ETH TSS key + wallet and save each party's wallet file like `create`/`join` do */
  const createTssWalletFiles = async () => {
    const keygens = walletNames.map(() => new TssKey.TssKeyGen({
      chain,
      network,
      baseUrl: host + '/bws/api',
      key: new Key({ seedType: 'new' })
    }));
    await keygens[0].newKey({ m: 2, n: 3 });
    for (const partyId of [1, 2]) {
      const code = await keygens[0].createJoinCode({ partyId, partyPubKey: keygens[partyId].getAuthPublicKey() });
      await keygens[partyId].joinKey({ code });
    }
    const completed = keygens.map(keygen => new Promise((resolve, reject) => {
      keygen.once('complete', resolve);
      keygen.on('error', reject);
    }));
    for (const [partyId, keygen] of keygens.entries()) {
      keygen.subscribe({ timeout: 10, walletName: partyId === 0 ? walletNames[0] : undefined, copayerName: 'party' + partyId });
    }
    await Promise.all(completed);

    for (const [partyId, keygen] of keygens.entries()) {
      const key = keygen.getTssKey(PASSWORD);
      const credentials = key.createCredentials(PASSWORD, { chain, network, account: 0 });
      fs.writeFileSync(path.join(tempDir, walletNames[partyId] + '.json'), JSON.stringify({ key: key.toObj(), credentials: credentials.toObj() }));
    }
    // Loading syncs the wallet info from BWS into the wallet files
    for (const name of walletNames) {
      await loadWallet(name);
    }
  };

  before(async function() {
    await helpers.startBws();
    sandbox.stub(process, 'exit').throws(new Error('process.exit was called'));
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-cli-sibling-'));
    await createTssWalletFiles();
  });

  after(async function() {
    sandbox.restore();
    await helpers.stopBws();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Wallet.createSiblingWallet', function() {
    const siblingNames = walletNames.map(name => name + '_arb');
    const createSibling = async (partyId: number) => {
      const wallet = await loadWallet(walletNames[partyId]);
      return wallet.createSiblingWallet({ walletName: siblingNames[partyId], chain: 'arb', network });
    };

    it('should tell the other parties to wait for the leader to create the sibling wallet', async function() {
      await assert.rejects(() => createSibling(1), /The TSS session leader needs to create the wallet first/);
      assert.strictEqual(walletFileExists(siblingNames[1]), false);
    });

    it('should save the sibling wallet created by the leader', async function() {
      const sibling = await createSibling(0);
      assert.strictEqual(sibling.name, siblingNames[0]);

      const base = readWalletFile(walletNames[0]);
      const saved = readWalletFile(siblingNames[0]);
      assert.strictEqual(saved.credentials.chain, 'arb');
      assert.strictEqual(saved.credentials.walletName, siblingNames[0]);
      assert.strictEqual(saved.credentials.tssKeyId, base.credentials.tssKeyId);
      assert.strictEqual(saved.credentials.clientDerivedPublicKey, base.credentials.clientDerivedPublicKey);
      assert.notStrictEqual(saved.credentials.walletId, base.credentials.walletId);
      assert.deepStrictEqual(saved.key.metadata, base.key.metadata);
      // The key is saved encrypted, same as the base wallet
      assert.strictEqual(saved.key.xPrivKey, null);
      assert.strictEqual(saved.key.keychain.privateKeyShare, undefined);
      assert.strictEqual(saved.key.keychain.privateKeyShareEncrypted, base.key.keychain.privateKeyShareEncrypted);
    });

    it('should save the sibling wallet joined by the other parties', async function() {
      const leaderWalletId = readWalletFile(siblingNames[0]).credentials.walletId;
      for (const partyId of [1, 2]) {
        await createSibling(partyId);
        const saved = readWalletFile(siblingNames[partyId]);
        assert.strictEqual(saved.credentials.chain, 'arb');
        assert.strictEqual(saved.credentials.walletId, leaderWalletId);
        assert.strictEqual(saved.credentials.walletName, siblingNames[0]);
      }
    });

    it('should load the sibling wallets', async function() {
      for (const name of siblingNames) {
        const sibling = await loadWallet(name);
        assert.strictEqual(sibling.chain, 'arb');
        assert.strictEqual(sibling.network, network);
        assert.strictEqual(sibling.isTss(), true);
        assert.strictEqual(sibling.isComplete(), true);
        assert.strictEqual(sibling.client.credentials.publicKeyRing.length, 3);
      }
    });

    it('should create a sibling wallet from a sibling wallet', async function() {
      const leader = await loadWallet(siblingNames[0]);
      await leader.createSiblingWallet({ walletName: 'arb_to_op0', chain: 'op', network });
      const joiner = await loadWallet(siblingNames[1]);
      await joiner.createSiblingWallet({ walletName: 'arb_to_op1', chain: 'op', network });
      assert.strictEqual(readWalletFile('arb_to_op1').credentials.walletId, readWalletFile('arb_to_op0').credentials.walletId);
    });

    it('should not overwrite an existing wallet file', async function() {
      const before = fs.readFileSync(path.join(tempDir, siblingNames[0] + '.json'), 'utf-8');
      await assert.rejects(() => createSibling(0), /already exists/);
      assert.strictEqual(fs.readFileSync(path.join(tempDir, siblingNames[0] + '.json'), 'utf-8'), before);
    });

    it('should only create sibling wallets for TSS wallets', async function() {
      fs.copyFileSync(path.join(DIR, BTC.SINGLE_SIG + '.json'), path.join(tempDir, BTC.SINGLE_SIG + '.json'));
      const wallet = await loadWallet(BTC.SINGLE_SIG, { doNotComplete: true });
      await assert.rejects(
        () => wallet.createSiblingWallet({ walletName: 'singlesig_eth', chain: 'eth', network }),
        /Sibling wallets are only supported for TSS wallets/
      );
      assert.strictEqual(walletFileExists('singlesig_eth'), false);
    });

    it('should save the keygen chain with sibling wallets of keys generated before it was stored', async function() {
      for (const name of walletNames) {
        const walletFile = readWalletFile(name);
        delete walletFile.key.metadata.keygenChain;
        fs.writeFileSync(path.join(tempDir, name + '.json'), JSON.stringify(walletFile));
      }
      for (const [partyId, name] of walletNames.entries()) {
        const wallet = await loadWallet(name);
        await wallet.createSiblingWallet({ walletName: `legacy_matic${partyId}`, chain: 'matic', network });
        assert.strictEqual(readWalletFile(`legacy_matic${partyId}`).key.metadata.keygenChain, chain);
      }
      // The sibling wallets can be used as the base wallet
      for (const partyId of [0, 1, 2]) {
        const wallet = await loadWallet(`legacy_matic${partyId}`);
        await wallet.createSiblingWallet({ walletName: `legacy_matic_to_base${partyId}`, chain: 'base', network });
      }
      assert.strictEqual(readWalletFile('legacy_matic_to_base2').credentials.walletId, readWalletFile('legacy_matic_to_base0').credentials.walletId);
    });
  });

  describe('createsiblingwallet command', function() {
    let wallet: Wallet;
    let getChain: sinon.SinonStub;
    let getNetwork: sinon.SinonStub;
    let createSiblingWalletStub: sinon.SinonStub;
    let logError: sinon.SinonStub;
    const commandSandbox = sinon.createSandbox();
    const opts = { dir: '', host } as ICliWalletOptions;

    beforeEach(async function() {
      wallet = await loadWallet(walletNames[0]);
      getChain = commandSandbox.stub(promptsModule, 'getChain');
      getNetwork = commandSandbox.stub(promptsModule, 'getNetwork');
      createSiblingWalletStub = commandSandbox.stub(wallet, 'createSiblingWallet').resolves();
      commandSandbox.stub(prompt.log, 'info');
      commandSandbox.stub(prompt.log, 'success');
      logError = commandSandbox.stub(prompt.log, 'error');
    });

    afterEach(function() {
      commandSandbox.restore();
    });

    it('should name the sibling wallet after its chain', async function() {
      getChain.resolves('base');
      getNetwork.resolves(network);
      await createSiblingWallet({ wallet, opts });
      assert.strictEqual(getNetwork.firstCall.args[0], network); // defaults to the wallet's network
      assert.deepStrictEqual(createSiblingWalletStub.firstCall.args[0], { walletName: walletNames[0] + '_base', chain: 'base', network });
    });

    it('should add the network to the name if it differs from the wallet\'s', async function() {
      getChain.resolves(chain);
      getNetwork.resolves('regtest');
      await createSiblingWallet({ wallet, opts });
      assert.deepStrictEqual(createSiblingWalletStub.firstCall.args[0], { walletName: walletNames[0] + '_eth_regtest', chain, network: 'regtest' });
    });

    it('should not create a sibling wallet on the same chain and network', async function() {
      getChain.resolves(chain);
      getNetwork.resolves(network);
      await createSiblingWallet({ wallet, opts });
      assert.strictEqual(createSiblingWalletStub.called, false);
      assert.match(logError.firstCall.args[0], /must be on a different chain or network/);
    });

    it('should only be in the menu for TSS wallets', async function() {
      const findCommand = (w: Wallet) => getCommands({ wallet: w }).ADVANCED.find(c => c.value === 'createsiblingwallet');
      assert.strictEqual(findCommand(wallet).show(), true);
      fs.copyFileSync(path.join(DIR, BTC.SINGLE_SIG + '.json'), path.join(tempDir, BTC.SINGLE_SIG + '.json'));
      const singleSig = await loadWallet(BTC.SINGLE_SIG, { doNotComplete: true });
      assert.strictEqual(findCommand(singleSig).show(), false);
    });
  });
});
