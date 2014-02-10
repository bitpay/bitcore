'use strict';

angular.module('insight.address').controller('AddressController',
function($scope, $rootScope, $routeParams, $location, Global, Address, getSocket) {
  $scope.global = Global;

  $scope.findOne = function() {
    $rootScope.currentAddr = $routeParams.addrStr;

    Address.get({
      addrStr: $routeParams.addrStr
    },
    function(address) {
      $rootScope.titleDetail = address.addrStr.substring(0,7) + '...';
      $scope.address = address;
    },
    function(e) {
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

  var socket = getSocket($scope);
  socket.emit('subscribe', $routeParams.addrStr);
  socket.on($routeParams.addrStr, function(tx) {
    console.log('AddressTx event received ' + tx);
    $rootScope.$broadcast('tx', tx);
  });

  $scope.params = $routeParams;

});
