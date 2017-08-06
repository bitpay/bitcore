const Block  = require('../../models/block.js');
const logger = require('../logger');

const MAX_BLOCKS = 200;

function getBlock(params, options, cb) {
  const defaultOptions = { _id: 0 };

  Object.assign(defaultOptions, options);

  Block.find(
    params,
    defaultOptions,
    cb)
    .sort({ height: -1 })
    .limit(MAX_BLOCKS);
}

module.exports = function BlockAPI(router) {
  router.get('/block/:blockHash', (req, res) => {
    getBlock(
      { hash: req.params.blockHash },
      { rawBlock: 0 },
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        if (block[0]) {
          const b = block[0];
          res.json({
            hash: b.hash,
            size: b.size,
            height: b.height,
            version: b.version,
            merkleroot: b.merkleRoot,
            tx: b.txs,
            time: b.ts,
            nonce: b.nonce,
            bits: b.bits.toString(16),
            difficulty: 1,
            chainwork: b.chainwork.toString(16),
            confirmations: 0,
            previousblockhash: b.prevBlock,
            nextblockhash: 0,
            reward: b.reward / 1e8,
            isMainChain: true,
            poolInfo: {},
          });
        } else {
          res.send();
        }
      });
  });

  router.get('/blocks', (req, res) => {
    getBlock(
      {},
      { height: 1,
        size: 1,
        hash: 1,
        ts: 1,
        txs: 1,
        poolInfo: 1 },
      (err, blocks) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        res.json({
          blocks: blocks.map((block) => {
            return {
              hash: block.hash,
              height: block.height,
              size: block.size,
              time: block.ts,
              txlength: block.txs.length,
              poolInfo: {},
            };
          }),
          length: blocks.length,
          pagination: {},
        });
      });
  });

  router.get('/rawblock/:blockHash', (req, res) => {
    getBlock(
      { hash: req.params.blockHash },
      { rawBlock: 1 },
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        res.json(block[0]);
      });
  });

  router.get('/block-index/:height', (req, res) => {
    getBlock(
      { height: req.params.height },
      { hash: 1 },
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }

        if (block[0]) {
          res.json({
            blockHash: block[0].hash,
          });
        } else {
          res.send();
        }
      });
  });
};
