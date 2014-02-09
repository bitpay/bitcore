'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;

angular.module('insight.system').controller('IndexController',
  function($scope, $rootScope, Global, getSocket, Blocks, Transactions) {
  $scope.global = Global;

  var _getBlocks = function() {
    Blocks.get({
      limit: BLOCKS_DISPLAYED
    }, function(res) {
      $scope.blocks = res.blocks;
      $scope.blocksLength = res.lenght;
    });
  };
  
  var _getTransactions = function() {
    Transactions.get({
      limit: TRANSACTION_DISPLAYED
    }, function(res) {
      $scope.txs = res.txs;
    });
  };

  var socket = getSocket($scope);
  socket.emit('subscribe', 'inv');

  //show errors
  $scope.flashMessage = $rootScope.flashMessage || null;

  socket.on('tx', function(tx) {
    console.log('Transaction received! ' + JSON.stringify(tx));
    _getTransactions();
  });

  socket.on('block', function(block) {
    var blockHash = block.hash.hash.toString();
    console.log('Block received! ' + JSON.stringify(blockHash));
    _getBlocks();
  });

  $scope.humanSince = function(time) {
    var m = moment.unix(time);
    return m.max().fromNow();
  };

  $scope.index = function() {
    _getBlocks();
    _getTransactions();
  };

  $scope.txs = [];
  $scope.blocks = [];
});
