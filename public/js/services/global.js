'use strict';

//Global service for global variables
angular.module('insight.system').factory('Global',[
    function() {
    }
]);

angular.module('insight.system').factory('Version',
  function($resource) {
  return $resource('/api/version');
});

