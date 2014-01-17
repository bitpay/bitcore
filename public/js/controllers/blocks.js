'use strict';

angular.module('insight.blocks').controller('BlocksController', ['$scope', '$routeParams', '$location', 'Global', 'Block', 'Blocks', function ($scope, $routeParams, $location, Global, Block, Blocks) {
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
    });
  };

  $scope.params = $routeParams;
}]);
