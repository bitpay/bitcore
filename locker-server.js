(function() {
  var Locker = require('locker-server'),
    locker = new Locker();

  locker.listen(3003);
})();
