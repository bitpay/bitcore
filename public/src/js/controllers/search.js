'use strict';

angular.module('insight.search').controller('SearchController',
  function($scope, $routeParams, $location, $timeout, Global, Block, Transaction, Address, BlockByHeight) {
  $scope.global = Global;

  var _badQuery = function() {
    $scope.badQuery = true;

    $timeout(function() {
      $scope.badQuery = false;
    }, 2000);
  };

  $scope.search = function() {
    var q = $scope.q;
    $scope.badQuery = false;

    Block.get({
      blockHash: q
    }, function() {
      $scope.q = '';
      $location.path('block/' + q);
    }, function () { //block not found, search on TX
      Transaction.get({
        txId: q
      }, function() {
        $scope.q = '';
        $location.path('tx/' + q);
      }, function () { //tx not found, search on Address
        Address.get({
          addrStr: q
        }, function() {
          $scope.q = '';
          $location.path('address/' + q);
        }, function () { // block by height not found
          if (isFinite(q)) { // ensure that q is a finite number. A logical height value.
            BlockByHeight.get({
              blockHeight: q
            }, function(hash) {
              $scope.q = '';
              $location.path('/block/' + hash.blockHash);
            }, function() { //not found, fail :(
              _badQuery();
            });
          }
          else {
            _badQuery();
          }
        });
      });
    });
  };

});
