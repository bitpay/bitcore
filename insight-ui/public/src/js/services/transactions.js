'use strict';

angular.module('insight.transactions')
  .factory('Transaction',
    function($resource, Api) {
    return $resource(Api.apiPrefix + '/tx/:txId', {
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
  })
  .factory('TransactionsByBlock',
    function($resource, Api) {
    return $resource(Api.apiPrefix + '/txs', {
      block: '@block'
    });
  })
  .factory('TransactionsByAddress',
    function($resource, Api) {
    return $resource(Api.apiPrefix + '/txs', {
      address: '@address'
    });
  })
  .factory('Transactions',
    function($resource, Api) {
      return $resource(Api.apiPrefix + '/txs');
  });
