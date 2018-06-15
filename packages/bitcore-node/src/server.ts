import { P2pProvider } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import logger from './logger';
import config from './config';
import cluster = require('cluster');
import app from './routes';
import parseArgv from './utils/parseArgv';
// import { RPC } from './rpc';
// import { BlockModel } from './models/block';
// import { CoreBlock } from './types/namespaces/ChainAdapter';
let args = parseArgv([], ['DEBUG']);

const startServices = async () => {
  await Storage.start({});
  await Worker.start();

	// await (async () => {
	// 	const rpc = new RPC('bitpaytest', 'local321', '127.0.0.1', 21009);
	// 	let hash = '000000000000000004ec466ce4732fe6f1ed1cddc2ed4b328fff5224276e3f6f';
	// 	const blocks: CoreBlock[] = [];
	// 	for (let i = 0; i < 30; i += 1) {
	// 		const block = await rpc.blockAsync(hash);
	// 		logger.info(`Got block: ${block.hash}`);
	// 		blocks.push({
	// 			chain: 'BTC',
	// 			network: 'mainnet',
	// 			size: block.size,
	// 			transactions: [],
	// 			reward: 5000000,
	// 			header: {
	// 				hash,
	// 				prevHash: block.previousblockhash,
	// 				version: block.version,
	// 				time: block.time,
	// 				merkleRoot: block.merkleroot,
	// 				bits: block.bits.toString(),
	// 				nonce: block.nonce,
	// 			},
	// 		});
	// 		hash = block.previousblockhash;
	// 	}
	// 	await BlockModel.addBlocks(blocks);
	// })();
	// logger.info(`Done adding offset blocks.`);

  await P2pProvider.startConfiguredChains();
};

const startAPI = async () => {
  const server = app.listen(config.port, function() {
    logger.info(`API server started on port ${config.port}`);
  });
  // TODO this should be config driven
  server.timeout = 600000;
};

if (cluster.isMaster) {
  startServices();
  if (args.DEBUG) {
    startAPI();
  }
} else {
  if (!args.DEBUG) {
    startAPI();
  }
}
