'use strict';

angular.module('mystery.transactions').factory('Transaction', ['$resource', function($resource) {
  return $resource('/api/tx/:txId', {
    txId: '@txId'
  });
}]);

angular.module('mystery.transactions').factory('TransactionsByBlock', ['$resource', function($resource) {
  return $resource('/api/txb/:bId', {
    bId: '@bId'
  });
}]);

angular.module('mystery.transactions').factory('TransactionsByAddress', ['$resource', function($resource) {
  return $resource('/api/txa/:aId', {
    aId: '@aId'
  });
}]);

