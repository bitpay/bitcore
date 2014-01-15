'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;
angular.module('mystery.system').controller('IndexController', ['$scope', 'Global', 'socket', 'Blocks', 'Transactions', function($scope, Global, socket, Blocks, Transactions) {
  $scope.global = Global;

  socket.on('tx', function(tx) {
    console.log('Transaction received! ' + JSON.stringify(tx));
    if ($scope.txs.length === TRANSACTION_DISPLAYED) {
      $scope.txs.pop();
    }
    $scope.txs.unshift(tx);
  });

  socket.on('block', function(block) {
    console.log('Block received! ' + JSON.stringify(block));
    if ($scope.blocks.length === BLOCKS_DISPLAYED) {
      $scope.blocks.pop();
    }
    $scope.blocks.unshift(block);
  });

  $scope.index = function() {
    Blocks.get({
      limit: BLOCKS_DISPLAYED
    }, function(res) {
      $scope.blocks = res.blocks;
    });

    Transactions.query({
      limit: TRANSACTION_DISPLAYED
    }, function(txs) {
      $scope.txs = txs;
    });
  };

  $scope.txs = [];
  $scope.blocks = [];
}]);

