const router = require('express').Router();

const Block = require('../models/block');

router.get('/:blockId', function(req, res) {
  let {blockId} = req.params;
  let {chain, network} = req.query;
  chain = chain.toUpperCase();
  network = network.toLowerCase();
  let query = {chain, network};
  if (blockId.length === 64){
    query.hash = blockId;
  } else {
    let height = parseInt(blockId, 10);
    if (Number.isNaN(height) || height.toString(10) !== blockId) {
      return res.status(400).send('invalid block id provided');
    }
    query.height = height;
  }
  Block.findOne(query, function(err, block){
    if(err){
      return res.status(500).send(err);
    }
    if(!block) {
      return res.status(404).send('block not found');
    }
    res.json(Block._apiTransform(block,{object:true}));
  });
});

module.exports = {
  router: router,
  path: '/block'
};