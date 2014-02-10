'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;

angular.module('insight.system').controller('IndexController',
  function($scope, $rootScope, Global, getSocket, Blocks, Transaction) {
  $scope.global = Global;

  var _getBlocks = function() {
    Blocks.get({
      limit: BLOCKS_DISPLAYED
    }, function(res) {
      $scope.blocks = res.blocks;
      $scope.blocksLength = res.lenght;
    });
  };
 
  var _getTransaction = function(txid, cb) {
    Transaction.get({
      txId: txid
    }, function(res) {
      cb(res);
    });
  };

  var socket = getSocket($scope);
  socket.emit('subscribe', 'inv');

  //show errors
  $scope.flashMessage = $rootScope.flashMessage || null;

  socket.on('tx', function(tx) {
    console.log('Transaction received! ' + JSON.stringify(tx));

    var txStr = tx.toString();
    _getTransaction(txStr, function(res) {
      $scope.txs.unshift(res);
      if (parseInt($scope.txs.length, 10) >= parseInt(TRANSACTION_DISPLAYED, 10)) {
        $scope.txs = $scope.txs.splice(0, TRANSACTION_DISPLAYED);
      }
    });
  });

  socket.on('block', function(block) {
    var blockHash = block.toString();
    console.log('Block received! ' + JSON.stringify(blockHash));
    _getBlocks();
  });

  $scope.humanSince = function(time) {
    var m = moment.unix(time);
    return m.max().fromNow();
  };

  $scope.index = function() {
    _getBlocks();
  };

  $scope.txs = [];
  $scope.blocks = [];
});
