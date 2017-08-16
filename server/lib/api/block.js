const logger = require('../logger');
const db = require('../db');

module.exports = function BlockAPI(router) {
  router.get('/block/:blockHash', (req, res) => {
    // Pass Mongo params, fields and limit to db api.
    db.blocks.getBlock(
      { hash: req.params.blockHash },
      { rawBlock: 0 },
      1,
      (err, block) => {
        if (err) {
          logger.log('err', err);
          return res.status(404).send();
        }
        // Format the request for insight ui
        return res.json({
          hash:              block.hash,
          size:              block.size,
          height:            block.height,
          version:           block.version,
          merkleroot:        block.merkleRoot,
          tx:                block.txs,
          time:              block.ts,
          nonce:             block.nonce,
          bits:              block.bits.toString(16),
          difficulty:        1,
          chainwork:         block.chainwork.toString(16),
          confirmations:     0,
          previousblockhash: block.prevBlock,
          nextblockhash:     0,
          reward:            block.reward / 1e8,
          isMainChain:       true,
          poolInfo:          {},
        });
      });
  });

  router.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 100;
    // Pass Mongo params, fields and limit to db api.
    db.blocks.getBlocks(
      {},
      { height: 1,
        size: 1,
        hash: 1,
        ts: 1,
        txs: 1,
        poolInfo: 1,
      },
      limit,
      (err, blocks) => {
        if (err) {
          logger.log('err',
            `/blocks: ${err}`);
          return res.status(404).send();
        }
        // Format the request for insight ui
        return res.json({
          blocks: blocks.map(block => ({
            hash:     block.hash,
            height:   block.height,
            size:     block.size,
            time:     block.ts,
            txlength: block.txs.length,
            poolInfo: {},
          })),
          length:     blocks.length,
          pagination: {},
        });
      });
  });

  router.get('/rawblock/:blockHash', (req, res) => {
    const blockHash = req.params.blockHash || '';
    // Pass Mongo params, fields and limit to db api.
    db.blocks.getBlock(
      { hash: blockHash },
      { rawBlock: 1 },
      1,
      (err, block) => {
        if (err) {
          logger.log('err',
            `/rawblock/:blockHash: ${err}`);
          return res.status(404).send();
        }
        return res.json(block);
      });
  });

  router.get('/block-index/:height', (req, res) => {
    const blockHeight = parseInt(req.params.height, 10) || 1;
    // Pass Mongo params, fields and limit to db api.
    db.blocks.getBlock(
      { height: blockHeight },
      { hash: 1 },
      1,
      (err, block) => {
        if (err) {
          logger.log('err',
            `/block-index/:height: ${err}`);
          return res.status(404).send();
        }
        return res.json({
          blockHash: block.hash,
        });
      });
  });
};
