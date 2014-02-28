'use strict';

angular.module('insight.system').controller('ScannerController',
  function($scope, $rootScope, $modalInstance, Global) {
    $scope.global = Global;

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    var $searchInput = angular.element(document.getElementById('search')),
        video,
        canvas,
        $video,
        context,
        localMediaStream;

    var _scan = function() {
      if (localMediaStream) {
        context.drawImage(video, 0, 0, 300, 225);

        try {
          qrcode.decode();
        } catch(e) {
          //qrcodeError(e);
        }
      }

      setTimeout(_scan, 500);
    };

    var _successCallback = function(stream) {
      video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
      localMediaStream = stream;
      video.play();
      setTimeout(_scan, 1000);
    };

    var _scanStop = function() {
      $modalInstance.close();
      if (localMediaStream.stop) localMediaStream.stop();
      localMediaStream = null;
      video.src = '';
    };

    var _videoError = function(err) {
      console.log('Video Error: ' + JSON.stringify(err));
      _scanStop();
    };

    qrcode.callback = function(data) {
      _scanStop();

      var str = (data.indexOf('bitcoin:') === 0) ? data.substring(8) : data; 
      console.log('QR code detected: ' + str);
      $searchInput
        .val(str)
        .triggerHandler('change');
    };

    $modalInstance.opened.then(function() {
      //Start the scanner
      setTimeout(function() {
        video = document.getElementById('qrcode-scanner-video');
        canvas = document.getElementById('qr-canvas');
        $video = angular.element(video);
        context = canvas.getContext('2d');
        context.clearRect(0, 0, 300, 225);

        navigator.getUserMedia({video: true}, _successCallback, _videoError);
      }, 800);
    });

    $scope.cancel = function() {
      _scanStop();
    };
});
