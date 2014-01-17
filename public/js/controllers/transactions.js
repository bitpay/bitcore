'use strict';

angular.module('insight.transactions').controller('transactionsController',
    ['$scope',
    '$routeParams',
    '$location',
    'Global',
    'Transaction',
    'TransactionsByBlock',
    'TransactionsByAddress',
    'socket',
    function ($scope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress, socket) {
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
  socket.on('tx', function(tx) {
    console.log('Incoming message for new transaction!', tx);
    $scope.findTx(tx.txid);
  });

  $scope.txs = [];


}]);

