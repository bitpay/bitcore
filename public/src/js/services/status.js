'use strict';

angular.module('insight.status')
  .factory('Status',
    function($resource) {
      return $resource('/api/status', {
        q: '@q'
      });
    })
  .factory('Sync',
    function($resource) {
      return $resource('/api/sync');
    })
  .factory('PeerSync',
    function($resource) {
      return $resource('/api/peer');
    });
