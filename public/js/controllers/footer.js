'use strict';

angular.module('insight.system').controller('FooterController',
  function($scope, Version) {

    var _getVersion = function() {
      Version.get({},
      function(res) {
        $scope.version = res.version;
      });
    };

    $scope.version = _getVersion();

});
