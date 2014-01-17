'use strict';

angular.module('insight.address').factory('Address', ['$resource', function($resource) {
  return $resource('/api/addr/:addrStr', {
    addrStr: '@addStr'
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
}]);

