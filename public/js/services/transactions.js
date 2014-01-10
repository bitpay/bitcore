'use strict';

angular.module('mystery.transactions').factory('Transaction', ['$resource', function($resource) {
  return $resource('/api/tx/:txId', {
    txId: '@txId'
  });
}]);

