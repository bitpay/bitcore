'use strict';

angular.module('mystery.system').controller('IndexController', ['$scope', 'Global', 'Index', function ($scope, Global, Index) {
  $scope.global = Global;
  $scope.index = Index;
}]);
