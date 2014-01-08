'use strict';

angular.module('mystery.blocks').factory('Blocks', ['$resource', function($resource) {
  return $resource('/api/blocks');
}]);
