'use strict';

angular.module('insight.address').controller('AddressController',
    function ($scope, $rootScope, $routeParams, $location, Global, Address, get_socket) {
    $scope.global = Global;

    $scope.findOne = function() {
      Address.get({
        addrStr: $routeParams.addrStr
      }, function(address) {
        $scope.address = address;
      }, function(e) {
        if (e.status === 400) {
          $rootScope.flashMessage = 'Invalid Address: ' + $routeParams.addrStr;
        }
        else if (e.status === 503) {
          $rootScope.flashMessage = 'Backend Error. ' + e.data;
        }
        else {
          $rootScope.flashMessage = 'Address Not Found';
        }
        $location.path('/');
      });
    };
    var socket = get_socket($scope);
    socket.emit('subscribe', $routeParams.addrStr);

    $scope.params = $routeParams;
});
