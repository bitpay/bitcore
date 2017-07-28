'use strict';
var fs = require('fs');
var router = require('express').Router();

fs.readdirSync(__dirname + '/').forEach(function(file) {
  if(file.match(/\.js$/) !== null && file !== 'index.js') {
    var route = require('./' + file);
    router.use(route.path, route.router);
  }
});

module.exports = router;