'use strict';

angular.module('insight.status').factory('Status', ['$resource', function($resource) {
  return $resource('/api/status', {
    q: '@q'
  });
}]);

angular.module('insight.status').factory('Sync', ['$resource', function($resource) {
  return $resource('/api/sync');
}]);

