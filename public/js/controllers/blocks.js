'use strict';

angular.module('insight.blocks').controller('BlocksController',
  function ($scope, $rootScope, $routeParams, $location, Global, Block, Blocks) {
  $scope.global = Global;

  $scope.list = function() {
    Blocks.get({
      blockDate: $routeParams.blockDate
    }, function(res) {
      $scope.blocks = res.blocks;
      $scope.pagination = res.pagination;
    });
  };

  $scope.findOne = function() {
    Block.get({
      blockHash: $routeParams.blockHash
    }, function(block) {
      $scope.block = block;
    }, function(e) {
      if (e.status === 400) {
        $rootScope.flashMessage = 'Invalid Transaction ID: ' + $routeParams.txId;
      }
      else if (e.status === 503) {
        $rootScope.flashMessage = 'Backend Error. ' + e.data;
      }
      else {
        $rootScope.flashMessage = 'Block Not Found';
      }
      $location.path('/');
    });
  };

  $scope.params = $routeParams;
});
