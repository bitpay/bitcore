'use strict';

angular.module('mystery',
    ['ngAnimate',
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ui.bootstrap',
    'ui.route',
    'mystery.system',
    'mystery.index',
    'mystery.blocks',
    'mystery.transactions',
    'monospaced.qrcode',
    'mystery.address',
    'mystery.search',
    'mystery.status'
]);

angular.module('mystery.system', []);
angular.module('mystery.index', []);
angular.module('mystery.blocks', []);
angular.module('mystery.transactions', []);
angular.module('mystery.address', []);
angular.module('mystery.search', []);
angular.module('mystery.status', []);
