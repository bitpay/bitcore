'use strict';

angular.module('insight.transactions').factory('Transaction',
  function($resource) {
  return $resource('/api/tx/:txId', {
    txId: '@txId'
  }, {
    get: {
      method: 'GET',
      interceptor: {
        response: function (res) {
          return res.data;
        },
        responseError: function (res) {
          if (res.status === 404) {
            return res;
          }
        }
      }
    }
  });
});

angular.module('insight.transactions').factory('TransactionsByBlock',
  function($resource) {
  return $resource('/api/txs', {
    block: '@block'
  });
});

angular.module('insight.transactions').factory('TransactionsByAddress',
  function($resource) {
  return $resource('/api/txs', {
    address: '@address'
  });
});

angular.module('insight.transactions').factory('Transactions',
  function($resource) {
  return $resource('/api/txs');
});
