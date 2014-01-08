'use strict';

angular.module('mystery.blocks').factory('Block', ['$resource', function($resource) {
  return $resource('block/:blockHash', {
    blockHash: '@blockHash'
  });
}]);

angular.module('mystery.blocks').factory('Blocks', ['$resource', function($resource) {
  return $resource('/api/blocks');
}]);
