'use strict';

angular.module('mystery.blocks').controller('BlocksController', ['$scope', '$routeParams', '$location', 'Global', 'Block', 'Blocks', function ($scope, $routeParams, $location, Global, Block, Blocks) {
  $scope.global = Global;

  $scope.list = function() {
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
