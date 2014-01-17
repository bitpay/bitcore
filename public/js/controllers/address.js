'use strict';

angular.module('insight.address').controller('AddressController',
    ['$scope',
    '$routeParams',
    '$location',
    'Global',
    'Address',
    'socket',
    function ($scope, $routeParams, $location, Global, Address, socket) {
    $scope.global = Global;

    $scope.findOne = function() {
      Address.get({
        addrStr: $routeParams.addrStr
      }, function(address) {
        $scope.address = address;
      });
    };
    socket.on('connect', function() {
      socket.emit('subscribe', $routeParams.addrStr);
    });

    $scope.params = $routeParams;
}]);
