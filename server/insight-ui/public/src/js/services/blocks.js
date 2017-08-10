'use strict';

angular.module('insight.blocks')
  .factory('Block',
    function($resource, Api) {
    return $resource(Api.apiPrefix + '/block/:blockHash', {
      blockHash: '@blockHash'
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
  .factory('Blocks',
    function($resource, Api) {
      return $resource(Api.apiPrefix + '/blocks');
  })
  .factory('BlockByHeight',
    function($resource, Api) {
      return $resource(Api.apiPrefix + '/block-index/:blockHeight');
  });
