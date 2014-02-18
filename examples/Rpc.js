
var util = require('util');

// Replace path '..' to 'bitcore' if you are using this example
// in a different project
var RpcClient = require('../RpcClient').class();
var hash = process.argv[2] 
      || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';

 var config =  {   
   protocol:  'http',
   user:  'user',
   pass:  'pass',
   host:  '127.0.0.1',
   port:  '18332',
};
 

var rpc   = new RpcClient(config);
rpc.getBlock( hash,  function(err, ret) {
  console.log(err);
  console.log(util.inspect(ret, { depth: 10} ));
});
