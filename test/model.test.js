const db = require('../lib/db');
const Block = require('../models/block.js');

Block.findOne({}, function(err, block) {
  console.log(err)
  console.log(block)
})