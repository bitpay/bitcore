'use strict';

//Setting up route
angular.module('mystery').config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
    when('/block/:blockHash', {
      templateUrl: 'views/block.html'
    }).
    when('/', {
      templateUrl: 'views/index.html'
    }).
    otherwise({
      redirectTo: '/'
    });
  }
]);

//Setting HTML5 Location Mode
angular.module('mystery').config(['$locationProvider',
  function($locationProvider) {
    $locationProvider.hashPrefix('!');
  }
]);
