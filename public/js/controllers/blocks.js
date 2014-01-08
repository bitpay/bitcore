'use strict';

angular.module('mystery.blocks').controller('BlocksController', ['$scope', '$routeParams', '$location', 'Global', 'Blocks', function ($scope, $routeParams, $location, Global, Blocks) {
  $scope.global = Global;
  
  // for avoid warning. please remove when you use Blocks
  $scope.blocks = Blocks;
}]);
