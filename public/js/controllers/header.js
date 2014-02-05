'use strict';

angular.module('insight.system').controller('HeaderController',
  function($scope, $rootScope, getSocket, Global, Block, Currency) {
  $scope.global = Global;

  Currency.get();

  $scope.menu = [
    {
      'title': 'Blocks',
      'link': 'blocks'
    },
    {
      'title': 'Status',
      'link': 'status'
    },
    {
      'title': 'Developers',
      'link': 'developers'
    }
  ];

  var socket = getSocket($scope);
  socket.emit('subscribe', 'inv');

  var _getBlock = function(hash) {
    Block.get({
      blockHash: hash
    }, function(res) {
      $scope.totalBlocks = res.height;
    });
  };

  socket.on('block', function(block) {
    var blockHash = block.hash.toString();
    console.log('Updated Blocks Height!');
    _getBlock(blockHash);
  });

  $rootScope.isCollapsed = true;
});
