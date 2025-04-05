import { Wallet } from 'bitcore-client';
import * as _ from 'lodash';
import { CoinStorage } from '../../src/models/coin';
import { Storage } from '../../src/services/storage';

async function getAllAddressesFromBlocks(start, end) {
  if (!Storage.connected) await Storage.start({});
  const coins = await CoinStorage.collection
    .find({ chain: 'BTC', network: 'mainnet', mintHeight: { $gte: start, $lte: end } })
    .project({ address: 1 })
    .toArray();
  const uniqueAddresses = _.uniq(coins.map(c => c.address));
  return uniqueAddresses;
}

export async function createWallet(addresses: string[], iteration, networkName?: string) {
  const walletName = 'Benchmark Wallet' + iteration;
  const password = 'iamsatoshi';
  const chain = 'BTC';
  const network = networkName || 'mainnet';
  const baseUrl = 'http://localhost:3000/api';
  let lockedWallet: Wallet;

  try {
    lockedWallet = await Wallet.loadWallet({ name: walletName });
  } catch (err) {
    lockedWallet = await Wallet.create({
      name: walletName,
      chain,
      network,
      baseUrl,
      password
    });
  }
  await lockedWallet.register({ baseUrl });

  if (addresses.length > 0) {
    const unlockedWallet = await lockedWallet.unlock(password);

    const keysToImport = addresses.map(a => ({ address: a }));
    await unlockedWallet.importKeys({ keys: keysToImport });
  }

  return lockedWallet;
}

async function benchMarkUtxoList(unlockedWallet: Wallet, addresses, includeSpent = false) {
  const utxoListStart = new Date();
  const utxoStream = unlockedWallet.getUtxos({ includeSpent });
  const utxoBenchmark = new Promise(resolve => {
    const utxos = new Array<string>();
    utxoStream
      .on('data', data => {
        const stringData = data.toString().replace(',\n', '');
        if (stringData.includes('{') && stringData.includes('}')) {
          utxos.push(JSON.parse(stringData));
        }
      })
      .on('complete', () => {
        const includeUnspentMsg = includeSpent ? '(+spent)' : '';
        console.log(
          `Listed ${includeUnspentMsg} `,
          (utxos || []).length,
          ' utxos for a wallet with',
          addresses.length,
          'addresses. Took ',
          new Date().getTime() - utxoListStart.getTime(),
          ' ms'
        );
        resolve(utxos);
      });
  });
  await utxoBenchmark;
}

async function bench(iteration = 0, startBlock = 0, endBlock = 100) {
  console.log('Benchmark', iteration, 'START');
  const addresses = await getAllAddressesFromBlocks(startBlock, endBlock);
  console.log('Collected', addresses.length, 'addresses');

  const walletCreationStart = new Date();
  const unlockedWallet = await createWallet(addresses, iteration);
  console.log(
    'Create a wallet with',
    addresses.length,
    'addresses. Took ',
    new Date().getTime() - walletCreationStart.getTime(),
    ' ms'
  );

  await benchMarkUtxoList(unlockedWallet, addresses);
  await benchMarkUtxoList(unlockedWallet, addresses, true);

  const walletTxListStart = new Date();
  const txStream = unlockedWallet.listTransactions({ startBlock, endBlock });
  let benchmarkComplete = new Promise(resolve => {
    const txs = new Array<any>();
    txStream.on('data', data => {
      const stringData = data.toString().replace(',\n', '');
      if (stringData.includes('{') && stringData.includes('}')) {
        txs.push(JSON.parse(stringData));
      }
    });
    txStream.on('complete', () => {
      console.log(
        'Listed ',
        txs.length,
        ' txs for a wallet with',
        addresses.length,
        'addresses. Took ',
        new Date().getTime() - walletTxListStart.getTime(),
        ' ms'
      );
      resolve(txs);
    });
  });
  await benchmarkComplete;
}

async function main() {
  for (let i = 1; i < 6; i++) {
    await bench(i, 0, Math.pow(10, i));
  }
  process.exit(0);
}
if (require.main === module) {
  main();
}
