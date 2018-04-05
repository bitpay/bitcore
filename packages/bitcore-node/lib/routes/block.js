const router = require('express').Router({ mergeParams: true });
const ChainStateProvider = require('../providers/chain-state');

router.get('/', async function(req, res) {
  let { chain, network, blockId } = req.params;
  try {
    let block = await ChainStateProvider.getBlocks(chain, network, blockId);
    if (!block) {
      return res.status(404).send('block not found');
    }
    res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:blockId', async function(req, res) {
  let { blockId, chain, network } = req.params;
  try {
    let block = await ChainStateProvider.getBlock(chain, network, blockId);
    if (!block) {
      return res.status(404).send('block not found');
    }
    res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/block'
};
