'use strict';

angular.module('mystery.blocks').factory('Blocks', ['$resource', function($resource) {
  return $resource('block/:blockHash', {
    blockHash: '@blockHash'
  });
}]);
