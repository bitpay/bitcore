'use strict';

module.exports = function(app, historicSync) {

  //Block routes
  var blocks = require('../app/controllers/blocks');
  app.get('/api/blocks', blocks.list);


  app.get('/api/block/:blockHash', blocks.show);
  app.param('blockHash', blocks.block);

  app.get('/api/block-index/:height', blocks.blockindex);
  app.param('height', blocks.blockindex);

  // Transaction routes
  var transactions = require('../app/controllers/transactions');
  app.get('/api/tx/:txid', transactions.show);
  app.param('txid', transactions.transaction);
  app.get('/api/txs', transactions.list);

  // Address routes
  var addresses = require('../app/controllers/addresses');
  app.get('/api/addr/:addr', addresses.show);
  app.param('addr', addresses.address);

  // Status route
  var st = require('../app/controllers/status');
  app.get('/api/status', st.show);

  app.get('/api/sync', st.sync);

  //Home route
  var index = require('../app/controllers/index');
  app.get('/api/version', index.version);
  app.get('*', index.render);
};
