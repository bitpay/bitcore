'use strict';

angular.module('mystery.address').controller('AddressController', ['$scope', '$routeParams', '$location', 'Global', 'Address', function ($scope, $routeParams, $location, Global, Address) {
    $scope.global = Global;

    $scope.findOne = function() {
      Address.get({
        addrStr: $routeParams.addrStr
      }, function(address) {
        $scope.address = address;
      });
    };

    $scope.params = $routeParams;
}]);
