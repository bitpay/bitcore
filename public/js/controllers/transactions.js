'use strict';

angular.module('insight.transactions').controller('transactionsController',
  function ($scope, $rootScope, $routeParams, $location, Global, Transaction, TransactionsByBlock, TransactionsByAddress, get_socket) {
  $scope.global = Global;
  $scope.loading = false;
  $scope.loadedBy = null;

  var pageNum = 0;
  var pagesTotal = 1;

  $scope.findThis = function() {
    $scope.findTx($routeParams.txId);
  };

  $scope.aggregateItems = function(items) {
    if (!items) return [];

    var l = items.length;

    var ret = [];
    var tmp = {};
    var u=0;
    // TODO multiple output address
    //
    for(var i=0; i < l; i++) {

      var notAddr = false;

      // non standard input
      if (items[i].scriptSig && !items[i].addr) {
        items[i].addr = 'Unparsed address [' + u++  + ']';
        items[i].notAddr = true;
        notAddr = true;
      }

      // non standard output
      if (items[i].scriptPubKey && !items[i].scriptPubKey.addresses) {
        items[i].scriptPubKey.addresses = ['Unparsed address [' + u++  + ']'];
        items[i].notAddr = true;
        notAddr = true;
      }

      // multiple addr at output
      if (items[i].scriptPubKey && items[i].scriptPubKey.addresses.length > 1) {
        items[i].addr = items[i].scriptPubKey.addresses.join(',');
        ret.push(items[i]);
        continue;
      }

      var addr = items[i].addr || (items[i].scriptPubKey && items[i].scriptPubKey.addresses[0] );

      if (!tmp[addr]) {
        tmp[addr] = {};
        tmp[addr].valueSat = 0;
        tmp[addr].count = 0;
        tmp[addr].addr = addr;
        tmp[addr].items = [];
      }
      tmp[addr].valueSat += items[i].valueSat;
      tmp[addr].value =  tmp[addr].valueSat / 100000000;
      tmp[addr].items.push(items[i]);
      tmp[addr].notAddr = notAddr;
      tmp[addr].count++;
    }

    angular.forEach(tmp, function(v) {
      ret.push(v);
    });
    return (ret);
  };

  $scope.processTX = function(tx) {
    tx.vinSimple = $scope.aggregateItems(tx.vin);
    tx.voutSimple = $scope.aggregateItems(tx.vout);
  };

  $scope.findTx = function(txid) {
    Transaction.get({
      txId: txid
    }, function(tx) {
      $scope.tx = tx;
      $scope.processTX(tx);
      $scope.txs.unshift(tx);
    }, function(e) {
      if (e.status === 400) {
        $rootScope.flashMessage = 'Invalid Transaction ID: ' + $routeParams.txId;
      }
      else if (e.status === 503) {
        $rootScope.flashMessage = 'Backend Error. ' + e.data;
      }
      else {
        $rootScope.flashMessage = 'Transaction Not Found';
      }
      $location.path('/');
    });
  };

  $scope.byBlock = function() {
    TransactionsByBlock.get({
     block: $routeParams.blockHash,
     pageNum: pageNum
    }, function(data) {
      $scope.paginate(data);
    });
  };

  $scope.byAddress = function () {
    TransactionsByAddress.get({
     address: $routeParams.addrStr,
     pageNum: pageNum
    }, function(data) {
      $scope.paginate(data);
    });
  };

  $scope.paginate = function (data) {
    $scope.loading = false;

    pagesTotal = data.pagesTotal;
    pageNum += 1;

    data.txs.forEach(function(tx) {
      $scope.processTX(tx);
      $scope.txs.push(tx);
    });
  };

  $scope.load = function(from) {
    $scope.loadedBy = from;
    $scope.loadMore();
  };

  $scope.loadMore = function() {
    if (pageNum < pagesTotal && !$scope.loading) {
      $scope.loading = true;

      if ($scope.loadedBy === 'address') {
        $scope.byAddress();
      }
      else {
        $scope.byBlock();
      }
    }
  };

  var socket = get_socket($scope);
  socket.on('atx', function(tx) {
    console.log('atx '+tx.txid);
    var beep = new Audio('/sound/transaction.mp3');
    beep.play();
    $scope.findTx(tx.txid);
  });

  $scope.txs = [];

});
