'use strict';

angular.module('insight',
    ['ngAnimate',
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ui.bootstrap',
    'ui.route',
    'insight.system',
    'insight.socket',
    'insight.blocks',
    'insight.transactions',
    'monospaced.qrcode',
    'insight.address',
    'insight.search',
    'insight.status'
]);

angular.module('insight.system', []);
angular.module('insight.socket', []);
angular.module('insight.blocks', []);
angular.module('insight.transactions', []);
angular.module('insight.address', []);
angular.module('insight.search', []);
angular.module('insight.status', []);
