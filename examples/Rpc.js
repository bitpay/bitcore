'use strict';

// Replace '..' with 'bitcore' if you plan on using this code elsewhere.

var util      = require('util');
var RpcClient = require('../RpcClient');
var hash      = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';

 var config =  {   
   protocol: 'http',
   user:  	 'user',
   pass:  	 'pass',
   host:  	 '127.0.0.1',
   port:  	 '18332',
};
 
var rpc   = new RpcClient(config);

rpc.getBlock(hash, function(err, ret) {

  if(err) {
  	console.error("An error occured fetching block", hash);
  	console.error(err);
  	return;
  }

  console.log(ret);

});
