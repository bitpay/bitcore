'use strict';

angular.module('insight.status')
  .factory('Status',
    function($resource, Api) {
      return $resource(Api.apiPrefix + '/status', {
        q: '@q'
      });
    })
  .factory('Sync',
    function($resource, Api) {
      return $resource(Api.apiPrefix + '/sync');
    })
  .factory('PeerSync',
    function($resource, Api) {
      return $resource(Api.apiPrefix + '/peer');
    });
