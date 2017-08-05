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

module.exports = function BlockAPI(app) {
  app.get('/block/:blockHash', (req, res) => {
    getBlock(
      { hash: req.params.blockHash },
      { rawBlock: 0 },
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        res.json(block[0]);
      });
  });

  app.get('/blocks', (req, res) => {
    getBlock(
      {},
      { height: 1,
        size: 1,
        hash: 1,
        time: 1,
        transactionCount: 1,
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
              time: block.time,
              txlength: block.transactionCount
            };
          }),
          lenght: blocks.length,
          pagination: {},
        });
      });
  });

  app.get('/rawblock/:blockHash', (req, res) => {
    getBlock(
      { hash: req.params.blockHash },
      { rawBlock: 1 },
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        res.json(block);
      });
  });

  app.get('/block-index/:height', (req, res) => {
    getBlock(
      { height: req.params.height },
      {},
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        res.json(block);
      });
  });
};
