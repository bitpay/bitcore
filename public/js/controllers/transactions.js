'use strict';

angular.module('mystery.transactions').controller('transactionsController', ['$scope', '$routeParams', '$location', 'Global', 'Transaction', function ($scope, $routeParams, $location, Global, Transaction) {
  $scope.global = Global;

  $scope.findOne = function() {
    Transaction.get({
      txId: $routeParams.txId
    }, function(tx) {
      $scope.tx = tx;
    });
  };
}]);

