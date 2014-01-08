'use strict';

angular.module('mystery.blocks').controller('BlocksController', ['$scope', '$routeParams', '$location', 'Global', 'Blocks', function ($scope, $routeParams, $location, Global, Blocks) {
  $scope.global = Global;
  
  $scope.findOne = function() {
    Blocks.get({
      blockHash: $routeParams.blockHash
    }, function(block) {
      $scope.block = block;
    });
  };
  
  // for avoid warning. please remove when you use Blocks
  $scope.blocks = Blocks;
}]);
