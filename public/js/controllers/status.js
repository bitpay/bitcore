'use strict';

angular.module('insight.status').controller('StatusController',
function($scope, $routeParams, $location, $rootScope, Global, Status, Sync, get_socket) {
  $scope.global = Global;

  $scope.getStatus = function(q) {
    Status.get({
      q: 'get' + q
    },
    function(d) {
      $rootScope.infoError = null;
      angular.extend($scope, d);
    },
    function(e) {
      if (e.status === 503) {
        $rootScope.infoError = 'Backend Error. ' + e.data;
      }
      else {
        $rootScope.infoError = 'Unknown error:' + e.data;
      }
    });
  };

  var _onSyncUpdate = function(sync) {
    $scope.sync = sync;
  };

  $scope.getSync = function() {
    Sync.get({},
    function(sync) {
      _onSyncUpdate(sync);
    },
    function(e) {
      $scope.sync = { error: 'Could not get sync information' + e };
    });
  };

  var socket = get_socket($scope);
  socket.emit('subscribe', 'sync');
  socket.on('status', function(sync) {
    console.log('[status.js.55::] sync status update received!');
    _onSyncUpdate(sync);
  });

});

