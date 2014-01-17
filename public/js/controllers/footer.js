'use strict';

angular.module('insight.system').controller('FooterController', ['$scope', 'Global', 'socket', 'Status', function ($scope, Global, socket, Status) {
  $scope.global = Global;

  socket.on('block', function(block) {
console.log('[footer.js:14]',block); //TODO
    console.log('Block received! ' + JSON.stringify(block));
  });

  $scope.getFooter = function() {
    Status.get({
     q: 'getInfo'
    }, function(d) {
      $scope.info = d.info;
    });
  };

}]);

