'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;

angular.module('insight.system').controller('IndexController',
  function($scope, $rootScope, Global, getSocket, Blocks, Block, Transactions, Transaction) {
  $scope.global = Global;

  var _getTransaction = function(txid) {
    Transaction.get({
      txId: txid
    }, function(res) {
      $scope.txs.unshift(res);
    });
  };

  var _getBlock = function(hash) {
    Block.get({
      blockHash: hash
    }, function(res) {
      $scope.blocks.unshift(res);
    });
  };

  var socket = getSocket($scope);
  socket.emit('subscribe', 'inv');

  //show errors
  $scope.flashMessage = $rootScope.flashMessage || null;

  socket.on('tx', function(tx) {
    var txStr = tx.txid.toString();
    _getTransaction(txStr);

    console.log('Transaction received! ' + JSON.stringify(tx));
    if (parseInt($scope.txs.length, 10) >= parseInt(TRANSACTION_DISPLAYED, 10)) {
      $scope.txs = $scope.txs.slice(Math.max($scope.txs.length - TRANSACTION_DISPLAYED, 1));
    }
  });

  socket.on('block', function(block) {
    var blockHash = block.hash.toString();
    console.log('Block received! ' + JSON.stringify(block));
    if (parseInt($scope.blocks.length, 10) > parseInt(BLOCKS_DISPLAYED, 10) - 1) {
      $scope.blocks.pop();
    }

    _getBlock(blockHash);
  });

  $scope.humanSince = function(time) {
    var m = moment.unix(time);
    return m.max().fromNow();
  };

  $scope.index = function() {
    Blocks.get({
      limit: BLOCKS_DISPLAYED
    }, function(res) {
      $scope.blocks = res.blocks;
      $scope.blocksLength = res.lenght;
    });

    Transactions.get({
      limit: TRANSACTION_DISPLAYED
    }, function(res) {
      $scope.txs = res.txs;
    });
  };

  $scope.txs = [];
  $scope.blocks = [];
});
