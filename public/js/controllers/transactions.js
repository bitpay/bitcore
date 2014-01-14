'use strict';

angular.module('mystery.transactions').controller('transactionsController', ['$scope', '$routeParams', '$location', 'Global', 'Transaction', 'TransactionsByBlock', 'TransactionsByAddress', function ($scope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress) {
  $scope.global = Global;

  $scope.findOne = function() {
    Transaction.get({
      txId: $routeParams.txId
    }, function(tx) {
      $scope.tx = tx;
    });
  };

  $scope.byBlock = function(bId) {
    TransactionsByBlock.query({
     bId: bId
    }, function(txs) {
      $scope.txs = txs;
    });
  };

  $scope.byAddress = function(aId) {
    TransactionsByAddress.query({
     aId: aId
    }, function(txs) {
      $scope.txs = txs;
    });
  };


}]);

