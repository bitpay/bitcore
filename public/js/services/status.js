'use strict';

angular.module('mystery.status').factory('Status', ['$resource', function($resource) {
  return $resource('/api/status', {
    q: '@q'
  });
}]);

