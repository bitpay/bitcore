
var SINKey = require('./SINKey').class();

var sk = new SINKey();
sk.generate();
console.dir(sk.storeObj());

