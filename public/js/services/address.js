'use strict';

angular.module('mystery.address').factory('Address', ['$resource', function($resource) {
  return $resource('/api/addr/:addrStr', {
    addrStr: '@addStr'
  });
}]);

