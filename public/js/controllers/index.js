'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;
angular.module('mystery.system').controller('IndexController', ['$scope', 'Global', 'socket', function($scope, Global, socket) {
  $scope.global = Global;
  socket.on('tx', function(data) {
    var tx = data;
    console.log('Transaction received! ' + tx);
    if ($scope.txs.length === TRANSACTION_DISPLAYED) {
      $scope.txs.pop();
    }
    $scope.txs.unshift(tx);
  });

  socket.on('block', function(data) {
    var block = data;
    console.log('Block received! ' + block);
    if ($scope.blocks.length === BLOCKS_DISPLAYED) {
      $scope.blocks.pop();
    }
    $scope.blocks.unshift(block);
  });

  $scope.txs = [];
  $scope.blocks = [];

}]);

