'use strict';

angular.module('insight.status').controller('StatusController', ['$scope', '$routeParams', '$location', 'Global', 'Status', 'Sync', function ($scope, $routeParams, $location, Global, Status, Sync) {
  $scope.global = Global;

  $scope.getStatus = function(q) {
    Status.get({
     q: 'get' + q
    }, function(d) {
      angular.extend($scope, d);
    });
  };

  $scope.getSync = function() {
    Sync.get({}, function(sync) {
      $scope.sync = sync;
    }, function() {
      $rootScope.flashMessage = 'Could not get sync information';
    });
  };
}]);

