'use strict';

angular.module('mystery.system').controller('HeaderController', ['$scope', 'Global', function ($scope, Global) {
  $scope.global = Global;

  $scope.menu = [
    {
      'title': 'Blocks',
      'link': 'blocks'
    },
    {
      'title': 'Status',
      'link': 'status'
    }
  ];

  $scope.isCollapsed = false;
}]);
