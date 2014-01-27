'use strict';

angular.module('insight.address').controller('AddressController',
function($scope, $rootScope, $routeParams, $location, Global, Address, getSocket) {
  $scope.global = Global;

  $scope.findOne = function() {
    $rootScope.titleDetail = $rootScope.currentAddr = $routeParams.addrStr;

    Address.get({
      addrStr: $routeParams.addrStr
    },
    function(address) {
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
    console.log('atx ' + tx.txid);
    var beep = new Audio('/sound/transaction.mp3');
    beep.play();
    $rootScope.$broadcast('tx', tx.txid);
  });

  $scope.params = $routeParams;

});
