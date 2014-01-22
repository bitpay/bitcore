'use strict';

angular.module('insight.address').directive('whenScrolled', ['$window', function($window) {
  return {
    link: function(scope, elm, attr) {
      var pageHeight, clientHeight, scrollPos;
      $window = angular.element($window);

      var handler = function() {
        pageHeight = window.document.documentElement.scrollHeight;
        clientHeight = window.document.documentElement.clientHeight;
        scrollPos = window.pageYOffset;

        if (pageHeight - (scrollPos + clientHeight) === 0) {
          scope.$apply(attr.whenScrolled);
        }
      };

      $window.on('scroll', handler);
      scope.$on('$destroy', function() {
        return $window.off('scroll', handler);
      });
    }
  };
}]);
