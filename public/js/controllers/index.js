'use strict';

angular.module('mystery.system').controller('IndexController', ['$scope', 'Global', 'socket', function($scope, Global, socket) {
  $scope.global = Global;
  socket.on('tx', function(data) {
    var tx = data;
    console.log('Transaction received! ' + tx.txid);
    $scope.txs.unshift(tx.txid);
  });

  $scope.txs = [];

}]);

