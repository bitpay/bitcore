'use strict';
var router = require('express').Router();

var Block = require('../models/block');
var Storage = require('../services/storage');

const limit = 200;

router.get('/', function(req, res) {
  var query = {};
  if(req.query.height){
    query.height = req.query.height;
  }

  Storage.apiStreamingFind(Block,query,limit,req.query,res);
});

router.get('/:blockHash', function(req, res) {
  var blockHash = req.params.blockHash;
  if(!blockHash){
    return res.status(400).send(new Error('Missing required parameter: hash'));
  }
  var query = {hash: blockHash};
  Block.findOne(query, function(err, block){
    if(err){
      return res.status(500).send(err);
    }
    res.send(block);
  });
});

module.exports = {
  router: router,
  path: '/block'
};