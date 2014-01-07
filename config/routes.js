'use strict';

module.exports = function(app) {

  //Home route
  var index = require('../app/controllers/index');
  app.get('/', index.render);

  //Block routes

  var blocks = require('model/app/controllers/blocks');
  app.get('/block/:block_hash', blocks.show);
  
};
