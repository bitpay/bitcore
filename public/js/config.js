'use strict';

//Setting up route
angular.module('insight').config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
    when('/block/:blockHash', {
      templateUrl: '/views/block.html'
    }).
    when('/block-index/:blockHeight', {
      controller: 'BlocksController',
      templateUrl: '/views/redirect.html'
    }).
    when('/tx/:txId', {
      templateUrl: '/views/transaction.html'
    }).
    when('/', {
      templateUrl: '/views/index.html'
    }).
    when('/blocks', {
      templateUrl: '/views/blocks/list.html'
    }).
    when('/blocks-date/:blockDate', {
      templateUrl: '/views/blocks/list.html'
    }).
    when('/address/:addrStr', {
      templateUrl: '/views/address.html'
    }).
    when('/status', {
      templateUrl: '/views/status.html'
    }).
    otherwise({
      templateUrl: '/views/404.html'
    });
  }
]);

//Setting HTML5 Location Mode
angular.module('insight').config(['$locationProvider',
  function($locationProvider) {
    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!');
  }
]);
