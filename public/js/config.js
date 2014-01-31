'use strict';

//Setting up route
angular.module('insight').config(function($routeProvider) {
  $routeProvider.
    when('/block/:blockHash', {
      templateUrl: '/views/block.html',
      title: 'Bitcoin Block '
    }).
    when('/block-index/:blockHeight', {
      controller: 'BlocksController',
      templateUrl: '/views/redirect.html'
    }).
    when('/tx/:txId', {
      templateUrl: '/views/transaction.html',
      title: 'Bitcoin Transaction '
    }).
    when('/', {
      templateUrl: '/views/index.html',
      title: 'Home'
    }).
    when('/blocks', {
      templateUrl: '/views/blocks_list.html',
      title: 'Bitcoin Blocks solved Today'
    }).
    when('/blocks-date/:blockDate', {
      templateUrl: '/views/blocks_list.html',
      title: 'Bitcoin Blocks solved '
    }).
    when('/address/:addrStr', {
      templateUrl: '/views/address.html',
      title: 'Bitcoin Address '
    }).
    when('/status', {
      templateUrl: '/views/status.html',
      title: 'Status'
    }).
    otherwise({
      templateUrl: '/views/404.html',
      title: 'Error'
    });
});

//Setting HTML5 Location Mode
angular.module('insight')
  .config(function($locationProvider) {
    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!');
  })
  .run(function($rootScope, $route) {
    $rootScope.$on('$routeChangeSuccess', function() {
      //Change page title, based on Route information
      $rootScope.titleDetail = '';
      $rootScope.title = $route.current.title;
      $rootScope.isCollapsed = true;
    });
  });
