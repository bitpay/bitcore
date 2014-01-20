'use strict';

angular.module('insight.status').factory('Status',
  function($resource) {
  return $resource('/api/status', {
    q: '@q'
  });
});

angular.module('insight.status').factory('Sync',
  function($resource) {
  return $resource('/api/sync');
});

