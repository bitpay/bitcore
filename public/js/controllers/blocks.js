'use strict';

angular.module('mystery.blocks').controller('BlocksController', ['$scope', '$routeParams', '$location', 'Global', 'Blocks', function ($scope, $routeParams, $location, Global, Blocks) {
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

  // for avoid warning. please remove when you use Blocks
  $scope.blocks = Blocks;
}]);
