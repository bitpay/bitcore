'use strict';

angular.module('insight.address').controller('AddressController',
    ['$scope',
    '$rootScope',
    '$routeParams',
    '$location',
    'Global',
    'Address',
    'get_socket',
    function ($scope, $rootScope, $routeParams, $location, Global, Address, get_socket) {
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
    var socket = get_socket($scope);
    socket.emit('subscribe', $routeParams.addrStr);

    $scope.params = $routeParams;
}]);
