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
    function ($scope, $rootScope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress) {
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
  /*socket.on('tx', function(tx) {
    console.log('Incoming message for new transaction!', tx);
    $scope.findTx(tx.txid);
  });*/

  $scope.txs = [];

}]);
