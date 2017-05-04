'use strict';

angular.module('insight.currency').factory('Currency',
  function($resource, Api) {
    return $resource(Api.apiPrefix + '/currency');
});
