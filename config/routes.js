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
  app.get('/api/txs', transactions.list);

  // Address routes
  var addresses = require('../app/controllers/addresses');
  app.get('/api/addr/:addr', addresses.show);
  app.param('addr', addresses.address);

};
