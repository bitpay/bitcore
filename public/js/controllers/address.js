'use strict';

angular.module('mystery.address').controller('AddressController', ['$scope', '$routeParams', '$location', 'Global', 'Address', function ($scope, $routeParams, $location, Global, Address) {
/*
  $scope.address = '1JmTTDcksW7A6GN7JnxuXkMAXsVN9zmgm1';
  $scope.hash160 = '77ad7d08aaa9cf489ea4e468eaeb892b85f71e27';
  $scope.transactions = [
    {
      hash: '49a1d01759690476dbeec4a8efd969c09c6d4269ea2d88f4d9d4f098f021413c',
      time: 1234123445,
      amount: 0.3
    },
    {
      hash: 'cce948b422a4d485900fb82e64458720eb89f545af3f07ddf7d18660f9f881e9',
      time: 1234123445,
      amount: 0.1
    }
  ];
*/
    $scope.global = Global;

    $scope.findOne = function() {
      Address.get({
        addrStr: $routeParams.addrStr
      }, function(address) {
        $scope.address = address;
      });
    };

}]);
