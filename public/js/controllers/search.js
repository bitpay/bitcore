'use strict';

angular.module('insight.search').controller('SearchController',
  function ($scope, $routeParams, $location, Global, Block, Transaction, Address) {
  $scope.global = Global;

  $scope.search = function() {
    var q = $scope.q;

    $scope.badQuery = false;
    $scope.q = '';

    Block.get({
      blockHash: q
    }, function() {
      $location.path('block/' + q);
    }, function () { //block not found, search on TX
      Transaction.get({
        txId: q
      }, function() {
        $location.path('tx/' + q);
      }, function () { //tx not found, search on Address
        Address.get({
          addrStr: q
        }, function() {
          $location.path('address/' + q);
        }, function () { //address not found, fail :(
          $scope.badQuery = true;
          $scope.q = q;
        });
      });
    });
  };

});
