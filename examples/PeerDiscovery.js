var PeerManager = require('../lib/PeerManager');
var peerman     = new PeerManager();

peerman.discover({ limit: 6 }).start();
