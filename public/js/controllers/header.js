'use strict';

angular.module('insight.system').controller('HeaderController',
  function ($scope, get_socket, Global, Block) {
  $scope.global = Global;

  $scope.menu = [
    {
      'title': 'Blocks',
      'link': 'blocks'
    },
    {
      'title': 'Status',
      'link': 'status'
    }
  ];

  var socket = get_socket($scope);
  socket.emit('subscribe', 'inv');

  var getBlock = function(hash) {
    Block.get({
      blockHash: hash
    }, function(res) {
      $scope.totalBlocks = res.height;
    });
  };

  socket.on('block', function(block) {
    var blockHash = block.hash.toString();
    console.log('Updated Blocks Height!');
    getBlock(blockHash);
  });


  $scope.isCollapsed = false;
});
