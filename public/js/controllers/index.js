'use strict';

var TRANSACTION_DISPLAYED = 5;
var BLOCKS_DISPLAYED = 5;
angular.module('insight.system').controller('IndexController',
  function($scope, $rootScope, Global, get_socket, Blocks, Transactions) {
  $scope.global = Global;

  var socket = get_socket($scope);
  socket.emit('subscribe', 'inv');

  //show errors
  $scope.flashMessage = $rootScope.flashMessage || null;

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

  $scope.human_since = function(time) {
    var m = moment.unix(time);
    return m.max().fromNow();
  };

  $scope.index = function() {
    Blocks.get({
      limit: BLOCKS_DISPLAYED
    }, function(res) {
      $scope.blocks = res.blocks;
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
