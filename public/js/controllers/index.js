'use strict';

angular.module('mystery.system').controller('IndexController', ['$scope', 'Global', 'Index', function($scope, Global, Index) {
  $scope.global = Global;
  $scope.index = Index;
}]);

$(document).ready(function() {
  var socket = io.connect('http://localhost');
  socket.on('tx', function(data) {
    var tx = data;
    console.log('Transaction received! '+tx.txid);
  });

});

