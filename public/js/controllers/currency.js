'use strict';

angular.module('insight.currency').controller('CurrencyController',
  function($scope, $rootScope, Currency) {

    $rootScope.currency = {
      factor: 1,
      bitstamp: 0,
      symbol: 'BTC'
    };

    var _roundFloat = function(x, n) {
      if(!parseInt(n, 10) || !parseFloat(x)) n = 0;

      return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
    };

    $scope.setCurrency = function(currency) {
      $rootScope.currency.symbol = currency;

      if (currency === 'USD') {
        Currency.get({}, function(res) {
          $rootScope.currency.factor = $rootScope.currency.bitstamp = res.data.bitstamp;
        });
      } else if (currency === 'mBTC') {
        $rootScope.currency.factor = 1000;
      } else {
        $rootScope.currency.factor = 1;
      }
    };

    $scope.getConvertion = function(value) {
      if (typeof value !== 'undefined' && value !== null) {
        var response;

        if ($rootScope.currency.symbol === 'USD') {
          response = _roundFloat((value * $rootScope.currency.factor), 2);
        } else if ($rootScope.currency.symbol === 'mBTC') {
          $rootScope.currency.factor = 1000;
          response = _roundFloat((value * $rootScope.currency.factor), 5);
        } else {
          $rootScope.currency.factor = 1;
          response = value;
        }

        return response + ' ' + $rootScope.currency.symbol;
      }

      return 'value error';
    };

    // Get initial value
    Currency.get({}, function(res) {
      $rootScope.currency.bitstamp = res.data.bitstamp;
    });

  });
