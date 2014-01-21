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

  var on_sync_update = function(sync) {

    if (!sync.error) {
      if (sync.blocksToSync > sync.syncedBlocks) {
        var p = parseInt(100*(sync.syncedBlocks) / sync.blocksToSync);
        var delta = sync.blocksToSync - sync.syncedBlocks;
        sync.message = 'Sync ' + p + '% ['+delta+' blocks remaining]';
        sync.style = 'warn';
      } else {
        sync.message = 'On sync';
        sync.style = 'success';
      }
      sync.tooltip = 'Synced blocks: '+sync.syncedBlocks;
    }
    $scope.sync = sync;
  };

  $scope.getSync = function() {
    Sync.get({},
    function(sync) {
      on_sync_update(sync);
    },
    function(e) {
      $scope.sync = { error: 'Could not get sync information' + e };
    });
  };

  var socket = get_socket($scope);
  socket.emit('subscribe', 'sync');
  socket.on('status', function(sync) {

console.log('[status.js.55::] sync status update received!');
    on_sync_update(sync);
  });

});

