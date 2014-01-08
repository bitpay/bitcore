'use strict';

angular.module('mystery.blocks').controller('BlocksController', ['$scope', '$routeParams', '$location', 'Global', 'Block', 'Blocks', function ($scope, $routeParams, $location, Global, Block, Blocks) {
  $scope.global = Global;

  $scope.list_blocks = function() {
    Blocks.query(function(blocks) {
      $scope.blocks = blocks;
    });
  };

  $scope.list_blocks_date = function() {
    Blocks.query({
      blockDate: $routeParams.blockDate
    }, function(blocks) {
      $scope.blocks = blocks;
    });
  };

  $scope.findOne = function() {
    Block.get({
      blockHash: $routeParams.blockHash
    }, function(block) {
      $scope.block = block;
    });
  };

  // for avoid warning. please remove when you use Blocks
  $scope.blocks = Blocks;
}]);
