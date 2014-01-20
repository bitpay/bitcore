'use strict';

angular.module('insight.address').controller('AddressController',
    ['$scope',
    '$rootScope',
    '$routeParams',
    '$location',
    'Global',
    'Address',
    'socket',
    function ($scope, $rootScope, $routeParams, $location, Global, Address, socket) {
    $scope.global = Global;

    $scope.findOne = function() {
      Address.get({
        addrStr: $routeParams.addrStr
      }, function(address) {
        $scope.address = address;
      }, function() {
        $rootScope.flashMessage = 'Address Not Found';
        $location.path('/');
      });
    };
    socket.on('connect', function() {
      socket.emit('subscribe', $routeParams.addrStr);
    });

    $scope.params = $routeParams;
}]);
