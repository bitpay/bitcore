'use strict';

var fs = require('fs');
var HeaderDB = require('./HeaderDB').class();
var Block = require('bitcore/Block').class();
var CoinConst = require('bitcore/const');
var coinUtil = require('bitcore/util/util');
var networks = require('bitcore/networks');
var Parser = require('bitcore/util/BinaryParser').class();

var peerdb_fn = 'peerdb.json';

var peerdb = undefined;
var hdrdb = undefined;
var network = networks.testnet;
var config = {
  network : network.name
};
var PeerManager = require('bitcore/PeerManager').createClass({
  config : config
});
var Peer = require('bitcore/Peer').class();

function peerdb_load() {
  try {
    peerdb = JSON.parse(fs.readFileSync(peerdb_fn));
  } catch (d) {
    console.warn('Unable to read peer db', peerdb_fn, 'creating new one.');
    peerdb = [ {
      ipv4 : '127.0.0.1',
      port : 18333
    }, ];

    fs.writeFileSync(peerdb_fn, JSON.stringify(peerdb));
  }
}

function hdrdb_load()
{
  hdrdb = new HeaderDB({network: network});
}

function get_more_headers(info) {
  var conn = info.conn;
  var loc = hdrdb.locator();
  conn.sendGetHeaders(loc, coinUtil.NULL_HASH);
}

function add_header(info, block) {
  var hashStr = coinUtil.formatHashFull(block.calcHash());

  try {
      hdrdb.add(block);
  } catch (e) {
    return;
  }
}

function handle_headers(info) {
  console.log('handle headers');
  var headers = info.message.headers;

  headers.forEach(function(hdr) {
    add_header(info, hdr);
  });

  // We persist the header DB after each batch
  //hdrdb.writeFile(hdrdb_fn);

  // Only one request per batch of headers we receive.
  get_more_headers(info);
}


function handle_verack(info) {
  var inv = {
    type : CoinConst.MSG.BLOCK,
    hash : network.genesisBlock.hash,
  };
  var invs = [ inv ];

  // Asks for the genesis block
  // console.log('p2psync: Asking for the genesis block');
  // info.conn.sendGetData(invs);

}

function handle_inv(info) {
  console.log('handle inv');
  // TODO: should limit the invs to objects we haven't seen yet
  var invs = info.message.invs;
  invs.forEach(function(inv) {
      console.log('Received inv for a '+CoinConst.MSG.to_str(inv.type));
    }
  );
  console.log('requesting getData');
  info.conn.sendGetData(invs);
}

function handle_tx(info) {
  var tx = info.message.tx.getStandardizedObject();
  console.log('handle tx: '+JSON.stringify(tx));

}

function handle_block(info) {
  console.log('handle block');
  var block = info.message.block;
  add_header(info, block);
}

function handle_connected(data) {
  var peerman = data.pm;
  var peers_n = peerman.peers.length;
  console.log('p2psync: Connected to ' + peers_n + ' peer' + (peers_n !== 1 ? 's' : ''));
}

function p2psync() {
  var peerman = new PeerManager();

  peerdb.forEach(function(datum) {
    var peer = new Peer(datum.ipv4, datum.port);
    peerman.addPeer(peer);
  });

  peerman.on('connection', function(conn) {
    conn.on('verack', handle_verack);
    conn.on('block', handle_block);
    conn.on('headers', handle_headers);
    conn.on('inv', handle_inv);
    conn.on('tx', handle_tx);
  });
  peerman.on('connect', handle_connected);

  peerman.start();
}

function filesync_block_buf(blkdir, fn, buf) {
  var parser = new Parser(buf);
  var block = new Block();
  block.parse(parser, true);

  var hashStr = coinUtil.formatHashFull(block.calcHash());

  try {
    hdrdb.add(block);
  } catch (e) {
    var height = hdrdb.size();
    console.log('HeaderDB failed adding block #' + height + ', ' + hashStr);
    console.log('   Reason: ' + e);
    return;
  }

  var height = hdrdb.size() - 1;
  if ((height % 1000) == 0)
    console.log('HeaderDB added block #' + height + ', ' + hashStr);
}

function filesync_open_cb(err, fd, blkdir, fn) {
  if (err)
    throw err;

  var hdrbuf = new Buffer(4 * 2);
  while (1) {
    // read 2x 32-bit header
    var bread = fs.readSync(fd, hdrbuf, 0, 4 * 2, null);
    if (bread < (4 * 2)) {
      console.log('Short read/EOF, ending scan of ' + fn);
      break;
    }

    // check magic matches
    var magic = hdrbuf.slice(0, 4);
    if (magic.toString() != network.magic.toString()) {
      console.log('Invalid network magic, ending scan of ' + fn);
      break;
    }

    // block size
    var blkSize = hdrbuf.readUInt32LE(4);
    if (blkSize > (1 * 1024 * 1024))
      throw new Error('Invalid block size ' + blkSize);

    // read raw block data
    var blkBuf = new Buffer(blkSize);
    bread = fs.readSync(fd, blkBuf, 0, blkSize, null);
    if (bread != blkSize)
      throw new Error('Failed to read block');

    // process block
    filesync_block_buf(blkdir, fn, blkBuf);
  }

  fs.closeSync(fd);

  hdrdb.writeFile(hdrdb_fn);
  console.log('Wrote header db');
}

function filesync_block_file(blkdir, fn) {
  console.log('Scanning ' + fn + ' for block data.');

  var pathname = blkdir + '/' + fn;
  fs.open(pathname, 'r', function(err, fd) {
    filesync_open_cb(err, fd, blkdir, fn);
  });
}

function cmd_filesync_rd(err, files, blkdir) {
  if (err)
    throw err;

  files = files.sort();

  var scanned = 0;
  files.forEach(function(fn) {
    var re = /^blk\d+\.dat$/;
    if (fn.match(re)) {
      filesync_block_file(blkdir, fn);
      scanned++;
    }
  });

  console.log('Scanned ' + scanned + ' of ' + files.length + ' files in '
      + blkdir);
}

function main() {
  peerdb_load();
  hdrdb_load();

  p2psync();
}

main();
