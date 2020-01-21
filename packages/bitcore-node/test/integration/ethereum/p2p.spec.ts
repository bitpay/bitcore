import config from '../../../src/config';
import * as BitcoreClient from 'bitcore-client';
import { expect } from 'chai';
import { resetDatabase } from '../../helpers';
import { EthP2pWorker } from '../../../src/modules/ethereum/p2p/p2p';
import { EthBlockStorage } from '../../../src/modules/ethereum/models/block';
import { Api } from '../../../src/services/api';

const chain = 'ETH';
const network = 'testnet';
const chainConfig = config.chains[chain][network];
const name = 'EthereumWallet';
const baseUrl = 'http://localhost:3000/api';
const password = '';
const phrase = 'kiss talent nerve fossil equip fault exile execute train wrist misery diet';
const account = '0x00a329c0648769a73afac7f9381e08fb43dbea72';

async function getWallet() {
  let wallet: BitcoreClient.Wallet;
  try {
    wallet = await BitcoreClient.Wallet.loadWallet({ name });
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
  this.timeout(50000);

  before(async () => {
    await Api.start();
    await resetDatabase();
  });

  after(async () => {
    await Api.stop();
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

    const web3 = await worker.getWeb3();
    await web3.eth.sendTransaction({ to: addresses[0], value: web3.utils.toWei('.01', 'ether'), from: account });
    await sawBlock;
    await worker.disconnect();
  });

  it('should be able to save blocks to the database', async () => {
    const wallet = await getWallet();
    const addresses = await wallet.getAddresses();

    const worker = new EthP2pWorker({ chain, network, chainConfig });
    await worker.start();
    const sawBlock = new Promise(resolve => worker.events.on('block', resolve));

    const web3 = await worker.getWeb3();
    await web3.eth.sendTransaction({ to: addresses[0], value: web3.utils.toWei('.02', 'ether'), from: account });
    await sawBlock;
    await worker.syncDone();
    await worker.stop();

    const dbBlocks = await EthBlockStorage.collection.count({ chain, network });
    expect(dbBlocks).to.be.gt(0);
  });

  it('should be able to handle reorgs');
  it('should be able to handle a failed getBlock');

  it('should be able to get tx events from parity');
  it('should be able to save transactions to the database');
});
