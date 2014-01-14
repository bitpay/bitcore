'use strict';

module.exports = function(app) {

  //Home route
  var index = require('../app/controllers/index');
  app.get('/', index.render);

  //Block routes
  var blocks = require('../app/controllers/blocks');
  app.get('/api/blocks', blocks.list);


  app.get('/api/block/:blockHash', blocks.show);
  app.param('blockHash', blocks.block);

  // Transaction routes
  var transactions = require('../app/controllers/transactions');
  app.get('/api/tx/:txid', transactions.show);
  app.param('txid', transactions.transaction);

  app.get('/api/txb/:bId', transactions.getTransactionsByBlock);
  app.param('bId', transactions.getTransactionsByBlock);

  app.get('/api/txa/:aId', transactions.getTransactionsByAddress);
  app.param('aId', transactions.getTransactionsByAddress);


  var addresses = require('../app/controllers/addresses');
  app.get('/api/addr/:addr', addresses.show);
  app.param('addr', addresses.address);

};
