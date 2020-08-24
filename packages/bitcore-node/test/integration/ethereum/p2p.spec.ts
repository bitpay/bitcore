import * as BitcoreClient from 'bitcore-client';
import { expect } from 'chai';
import config from '../../../src/config';
import { CacheStorage } from '../../../src/models/cache';
import { EthBlockStorage } from '../../../src/modules/ethereum/models/block';
import { EthP2pWorker } from '../../../src/modules/ethereum/p2p/p2p';
import { Api } from '../../../src/services/api';
import { wait } from '../../../src/utils/wait';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

const { StreamUtil } = BitcoreClient;
const chain = 'ETH';
const network = 'testnet';
const chainConfig = config.chains[chain][network];
const name = 'EthereumWallet-Ci';
const baseUrl = 'http://localhost:3000/api';
const password = '';
const phrase = 'kiss talent nerve fossil equip fault exile execute train wrist misery diet';
const account = '0x00a329c0648769a73afac7f9381e08fb43dbea72';

async function getWallet() {
  let wallet: BitcoreClient.Wallet;
  try {
    wallet = await BitcoreClient.Wallet.loadWallet({ name });
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
      phrase
    });
    await wallet.unlock(password);
    await wallet.nextAddressPair();
    await wallet.lock();
    return wallet;
  }
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

  it('should be able to get block events from parity', async () => {
    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();

    const worker = new EthP2pWorker({ chain, network, chainConfig });
    await worker.connect();
    await worker.setupListeners();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));

    const { web3 } = await worker.getWeb3();
    await web3.eth.sendTransaction({ to: addresses[0], value: web3.utils.toWei('.01', 'ether'), from: account });
    await sawBlock;
    await worker.disconnect();
    await worker.stop();
  });

  it('should be able to get the balance for the address', async () => {
    const wallet = await getWallet();
    const balance = await wallet.getBalance();
    expect(balance.confirmed).to.be.gt(0);

    const key = 'getBalanceForAddress-ETH-testnet-0xd8fd14fb0e0848cb931c1e54a73486c4b968be3d';
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
    await worker.connect();
    await worker.setupListeners();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));

    const { web3 } = await worker.getWeb3();
    await web3.eth.sendTransaction({ to: addresses[0], value: web3.utils.toWei('.01', 'ether'), from: account });
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
    await new Promise(r =>
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
    await web3.eth.sendTransaction({ to: addresses[0], value: web3.utils.toWei('.02', 'ether'), from: account });
    await sawBlock;
    await done;
    await worker.stop();

    const dbBlocks = await EthBlockStorage.collection.count({ chain, network });
    expect(dbBlocks).to.be.gt(0);
    await wallet.lock();
  });

  it('should be able to handle reorgs');
  it('should be able to handle a failed getBlock');

  it('should be able to get tx events from parity');
  it('should be able to save transactions to the database');
});
