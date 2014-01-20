'use strict';

angular.module('insight.transactions').controller('transactionsController',
    ['$scope',
    '$rootScope',
    '$routeParams',
    '$location',
    'Global',
    'Transaction',
    'TransactionsByBlock',
    'TransactionsByAddress',
    'get_socket',
    function ($scope, $rootScope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress, get_socket) {
  $scope.global = Global;

  $scope.findThis = function() {
    $scope.findTx($routeParams.txId);
  };

  $scope.findTx = function(txid) {
    Transaction.get({
      txId: txid
    }, function(tx) {
      $scope.tx = tx;
      $scope.txs.push(tx);
    }, function() {
      $rootScope.flashMessage = 'Transaction Not Found';
      $location.path('/');
    });
  };

  $scope.byBlock = function(bId) {
    TransactionsByBlock.query({
     block: bId
    }, function(txs) {
      $scope.txs = txs;
    });
  };

  $scope.byAddress = function(aId) {
    TransactionsByAddress.query({
     address: aId
    }, function(txs) {
      $scope.txs = txs;
    });
  };
  var socket = get_socket($scope);
  console.log('transactions.js');
  socket.on('atx', function(tx) {
    console.log('Incoming transaction for address!', tx);
    $scope.findTx(tx.txid);
  });

  $scope.txs = [];

}]);
