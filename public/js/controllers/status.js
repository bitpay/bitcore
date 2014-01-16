'use strict';

angular.module('mystery.status').controller('StatusController', ['$scope', '$routeParams', '$location', 'Global', 'Status', function ($scope, $routeParams, $location, Global, Status) {
  $scope.global = Global;
  
  $scope.getData = function(q) {
    Status.get({
     q: q
    }, function(d) {
      if (q == 'getInfo') {
        $scope.info = d.info;
      }
      if (q == 'getDifficulty') {
        $scope.difficulty = d.difficulty;
      }
      if (q == 'getTxOutSetInfo') {
        $scope.txoutsetinfo = d.txoutsetinfo;
      }
      if (q == 'getBestBlockHash') {
        $scope.bestblockhash = d.bestblockhash;
      }
    });
  };

}]);

