'use strict';

angular.module('mystery.index').factory('Index', ['$resource', function($resource) {
  return $resource('/last_blocks');
}]);
