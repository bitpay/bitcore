import hardhat from 'hardhat';

// geth --dev mines its first block only when a transaction arrives, and until that block is indexed it answers a
// receipt lookup that misses with "transaction indexing is in progress" instead of null. Ignition treats that error
// as fatal, so mine a block and wait for the indexer before deploying.
const TIMEOUT_MS = 60000;
// no transaction has this hash; looking it up returns null once the indexer is done
const UNKNOWN_TX = '0x' + '00'.repeat(32);

const { provider } = hardhat.network;

async function indexDone() {
  try {
    await provider.request({ method: 'eth_getTransactionReceipt', params: [UNKNOWN_TX] });
    return true;
  } catch (err) {
    if (err.message.includes('transaction indexing is in progress')) {
      return false;
    }
    throw err;
  }
}

async function main() {
  if (await indexDone()) {
    return;
  }
  const [from] = await provider.request({ method: 'eth_accounts' });
  await provider.request({ method: 'eth_sendTransaction', params: [{ from, to: from, value: '0x0' }] });
  const deadline = Date.now() + TIMEOUT_MS;
  while (!(await indexDone())) {
    if (Date.now() > deadline) {
      throw new Error(`geth transaction indexing still in progress after ${TIMEOUT_MS / 1000}s`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
