'use strict';

angular.module('insight.status').factory('Status', ['$resource', function($resource) {
  return $resource('/api/status', {
    q: '@q'
  });
}]);

