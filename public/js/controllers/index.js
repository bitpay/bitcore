'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;
angular.module('insight.system').controller('IndexController',
  function($scope, $rootScope, Global, get_socket, Blocks, Block, Transactions, Transaction) {
  $scope.global = Global;

  var getTransaction = function(txid) {
    Transaction.get({
      txId: txid
    }, function(res) {
      $scope.txs.unshift(res);
    });
  };

  var getBlock = function(hash) {
    Block.get({
      blockHash: hash
    }, function(res) {
      $scope.blocks.unshift(res);
    });
  };

  var socket = get_socket($scope);
  socket.emit('subscribe', 'inv');

  //show errors
  $scope.flashMessage = $rootScope.flashMessage || null;

  socket.on('tx', function(tx) {
    var txStr = tx.txid.toString();
    console.log('Transaction received! ' + JSON.stringify(tx));
    if ($scope.txs.length === TRANSACTION_DISPLAYED) {
      $scope.txs.pop();
    }
    getTransaction(txStr);
  });

  socket.on('block', function(block) {
    var blockHash = block.hash.toString();
    console.log('Block received! ' + JSON.stringify(block));
    if ($scope.blocks.length === BLOCKS_DISPLAYED) {
      $scope.blocks.pop();
    }
    getBlock(blockHash);
  });

  $scope.human_since = function(time) {
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
