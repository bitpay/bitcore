'use strict';

angular.module('insight.system').controller('FooterController',
    ['$scope',
    'Global',
    'Status',
    function ($scope, Global, Status) {
  $scope.global = Global;

  $scope.getFooter = function() {
    Status.get({
     q: 'getInfo'
    }, function(d) {
      $scope.info = d.info;
    });
  };

}]);

