import * as BitcoreClient from 'bitcore-client';
import { expect } from 'chai';
import { Web3 } from 'crypto-wallet-core';
import sinon from 'sinon';
import config from '../../../src/config';
import { CacheStorage } from '../../../src/models/cache';
import { EthP2pWorker } from '../../../src/modules/ethereum/p2p/p2p';
import { EVMBlockStorage } from '../../../src/providers/chain-state/evm/models/block';
import { Api } from '../../../src/services/api';
import { IEVMNetworkConfig } from '../../../src/types/Config';
import { wait } from '../../../src/utils/wait';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

const { StreamUtil } = BitcoreClient;
const chain = 'ETH';
const network = 'regtest';
const chainConfig = config.chains[chain][network] as IEVMNetworkConfig;
const name = 'EthereumWallet-Ci';
const storageType = 'Level';
const baseUrl = 'http://localhost:3000/api';
const password = '';
const phrase = 'kiss talent nerve fossil equip fault exile execute train wrist misery diet';
const accounts = { erigon: '0x67b1d87101671b127f5f8714789C7192f7ad340e', geth: '0xeC12CD1Ab86F83C1B26C5caa38126Bc4299b6CBa' };
const privKeys = { erigon: '26e86e45f6fc45ec6e2ecd128cec80fa1d1505e5507dcd2ae58c3130a7a97b48', geth: '0xf9ad2207e910cd649c9a32063dea3656380c32fa07d6bb9be853687ca585a015' };

async function getWallet() {
  let wallet: BitcoreClient.Wallet;
  try {
    wallet = await BitcoreClient.Wallet.loadWallet({ name, storageType });
    await wallet.register();
    await wallet.syncAddresses();
    return wallet;
  } catch (e) {
    console.log('Creating a new ethereum wallet');
    wallet = await BitcoreClient.Wallet.create({
      name,
      chain,
      network,
      baseUrl,
      password,
      phrase,
      storageType
    });
    await wallet.unlock(password);
    await wallet.nextAddressPair();
    await wallet.lock();
    return wallet;
  }
}

async function sendTransaction(from, to, amount, web3, wallet, nonce = 0) {
  if (!wallet) {
    wallet = await getWallet();
  }
  if (!nonce) {
    nonce = await web3.eth.getTransactionCount(accounts[from]);
  }
  const gasPrice = Number(await web3.eth.getGasPrice());
  const tx = await wallet.newTx({ recipients: [{ address: to, amount }], from: accounts[from], nonce, gasLimit: 21000, gasPrice });
  const signedTx = await wallet.signTx({ tx, signingKeys: [{ privKey: privKeys[from] }] });
  await web3.eth.sendSignedTransaction(signedTx);
}

describe('Ethereum', function() {
  const suite = this;
  this.timeout(50000);

  before(async () => {
    await intBeforeHelper();
    await resetDatabase();
    await Api.start();
  });

  after(async () => {
    await Api.stop();
    await intAfterHelper(suite);
  });

  it('should be able to create a wallet with an address', async () => {
    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();
    expect(addresses).to.exist;
    expect(addresses.length).to.eq(1);
    expect(addresses[0].toLowerCase()).to.equal('0xd8fd14fb0e0848cb931c1e54a73486c4b968be3d');
  });

  it('should be able to get block events from erigon', async () => {
    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();

    const worker = new EthP2pWorker({ chain, network, chainConfig });
    await worker.setupListeners();
    await worker.connect();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));

    const { web3 } = await worker.getWeb3();
    await sendTransaction('erigon', addresses[0], web3.utils.toWei('.01', 'ether'), web3, wallet);
    await sawBlock;
    await worker.disconnect();
    await worker.stop();
  });

  it('should be able to get block events from geth', async () => {
    const gethOnlyConfig = { ...chainConfig, provider: chainConfig.providers![1] };
    const { protocol, host, port } = gethOnlyConfig.provider;
    const getWeb3Stub = sinon.stub(EthP2pWorker.prototype, 'getWeb3').resolves({ web3: new Web3(`${protocol}://${host}:${port}`) });

    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();

    const worker = new EthP2pWorker({ chain, network, chainConfig: gethOnlyConfig });
    await worker.setupListeners();
    await worker.connect();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));

    const { web3 } = await worker.getWeb3();
    const nonce = await web3.eth.getTransactionCount(accounts['geth']);
    // sending multiple tx to entice geth to mine a block because sometimes it doesn't mine even with automine enabled
    sendTransaction('geth', addresses[0], web3.utils.toWei('.01', 'ether'), web3, wallet, nonce),
    sendTransaction('geth', addresses[0], web3.utils.toWei('.01', 'ether'), web3, wallet, nonce + 1)
    await sawBlock;
    await worker.disconnect();
    await worker.stop();
    getWeb3Stub.restore();
  });

  it('should be able to get the balance for the address', async () => {
    const wallet = await getWallet();
    const balance = await wallet.getBalance();
    expect(balance.confirmed).to.be.gt(0);

    const key = 'getBalanceForAddress-ETH-regtest-0xd8fd14fb0e0848cb931c1e54a73486c4b968be3d';
    const cached = await CacheStorage.collection.findOne({ key });
    expect(cached).to.exist;
    expect(cached!.value).to.deep.eq(balance);
    await wallet.lock();
  });

  it('should update after a send', async () => {
    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();
    const beforeBalance = await wallet.getBalance();

    const worker = new EthP2pWorker({ chain, network, chainConfig });
    await worker.setupListeners();
    await worker.connect();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));

    const { web3 } = await worker.getWeb3();
    await sendTransaction('erigon', addresses[0], web3.utils.toWei('.01', 'ether'), web3, wallet);
    await sawBlock;
    await worker.disconnect();
    await worker.stop();
    const afterBalance = await wallet.getBalance();
    expect(afterBalance).to.not.deep.eq(beforeBalance);
    expect(afterBalance.confirmed).to.be.gt(beforeBalance.confirmed);
    await wallet.lock();
  });

  it('should have receipts on tx history', async () => {
    const wallet = await getWallet();
    await new Promise<void>(r =>
      wallet
        .listTransactions({})
        .pipe(StreamUtil.jsonlBufferToObjectMode())
        .on('data', (tx: any) => {
          if (tx.height >= 0) {
            expect(tx.receipt).to.exist;
            expect(tx.receipt.gasUsed).to.exist;
            expect(tx.receipt.gasUsed).to.be.lte(tx.gasLimit);
            expect(tx.fee).to.eq(tx.gasPrice * tx.receipt.gasUsed);
          }
        })
        .on('finish', () => {
          r();
        })
    );

    await wallet.lock();
  });

  it.skip('should be able to save blocks to the database', async () => {
    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();

    const worker = new EthP2pWorker({ chain, network, chainConfig });
    const done = worker.syncDone();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));
    await worker.start();
    await wait(1000);

    const { web3 } = await worker.getWeb3();
    await sendTransaction('erigon', addresses[0], web3.utils.toWei('.02', 'ether'), web3, wallet);
    await sawBlock;
    await done;
    await worker.stop();

    const dbBlocks = await EVMBlockStorage.collection.count({ chain, network });
    expect(dbBlocks).to.be.gt(0);
    await wallet.lock();
  });

  it('should be able to handle reorgs');
  it('should be able to handle a failed getBlock');

  it('should be able to get tx events from parity');
  it('should be able to save transactions to the database');
});
