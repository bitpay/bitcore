'use strict';

angular.module('insight.transactions').controller('transactionsController', ['$scope', '$rootScope', '$routeParams', '$location', 'Global', 'Transaction', 'TransactionsByBlock', 'TransactionsByAddress', '$rootScope', function ($scope, $rootScope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress) {
  $scope.global = Global;

  $scope.findOne = function() {
    Transaction.get({
      txId: $routeParams.txId
    }, function(tx) {
      $scope.tx = tx;
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
}]);
