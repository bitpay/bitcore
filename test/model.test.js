const db = require('../lib/db');
const Block = require('../models/block.js');

Block.findOne({}, (err, block) => {
  console.log(err);
  console.log(block);
});
