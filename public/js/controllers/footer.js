'use strict';

angular.module('insight.system').controller('FooterController',
  function($rootScope, $scope, Version, Currency) {

    var _roundFloat = function(x, n) {
      if(!parseInt(n, 10) || !parseFloat(x)) n = 0;

      return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
    };

    $rootScope.currency = {
      factor: 1,
      symbol: 'BTC',
      bitstamp: 0,
      getConversion: function(value) {
        if (value !== 'undefined' && value !== null) {
          var response;

          if (this.symbol === 'USD') {
            response = _roundFloat((value * this.factor), 2);
          } else if (this.symbol === 'mBTC') {
            this.factor = 1000;
            response = _roundFloat((value * this.factor), 5);
          } else {
            this.factor = 1;
            response = value;
          }

          return response + ' ' + this.symbol;
        }

        return null;
      }
    };

    $scope.setCurrency = function(currency) {
      if (currency === 'USD') {
        Currency.get({}, function(res) {
          $rootScope.currency.factor = $rootScope.currency.bitstamp = res.data.bitstamp;
        });
      } else if (currency === 'mBTC') {
        $rootScope.currency.factor = 1000;
      } else {
        $rootScope.currency.factor = 1;
      }

      $rootScope.currency.symbol = currency;
    };

    var _getVersion = function() {
      Version.get({},
      function(res) {
        $scope.version = res.version;
      });
    };

    $scope.version = _getVersion();

});
