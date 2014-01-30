'use strict';

require('classtool');

function spec() {
  var Block = require('bitcore/block').class(),
   networks = require('bitcore/networks'),
   Parser   = require('bitcore/util/BinaryParser').class(),
   fs       = require('fs'),
   Buffer   = require('buffer').Buffer,
   glob     = require('glob'),
   async    = require('async');

  function BlockExtractor(dataDir, network) {

    var self = this;
    var path = dataDir + '/blocks/blk*.dat';

    self.dataDir = dataDir;
    self.files   = glob.sync(path);
    self.nfiles  = self.files.length;

    if (self.nfiles === 0)
      throw new Error('Could not find block files at: ' + path);

    self.currentFileIndex = 0;
    self.isCurrentRead    = false;
    self.currentBuffer    = null;
    self.currentParser    = null;
    self.network = network === 'testnet' ? networks.testnet: networks.livenet;
    self.magic   = self.network.magic.toString('hex');
  }

  BlockExtractor.prototype.currentFile = function() {
    var self = this;

    return self.files[self.currentFileIndex];
  };


  BlockExtractor.prototype.nextFile = function() {
    var self = this;

    if (self.currentFileIndex < 0) return false;

    var ret  = true;

    self.isCurrentRead = false;
    self.currentBuffer = null;
    self.currentParser = null;

    if (self.currentFileIndex < self.nfiles - 1) {
      self.currentFileIndex++;
    }
    else {
      self.currentFileIndex=-1;
      ret = false;
    }
    return ret;
  };

  BlockExtractor.prototype.readCurrentFileSync = function() {
    var self = this;

    if (self.currentFileIndex < 0 || self.isCurrentRead) return;


    self.isCurrentRead = true;

    var fname = self.currentFile();
    if (!fname) return;


    var stats = fs.statSync(fname);

    var size = stats.size;

    console.log('Reading Blockfile %s [%d MB]',
              fname, parseInt(size/1024/1024));

    var fd = fs.openSync(fname, 'r');

//    if (status) return cb(new Error(status.message));

    var buffer = new Buffer(size);

    var num = fs.readSync(fd, buffer, 0, size, 0);

    self.currentBuffer = buffer;
    self.currentParser = new Parser(buffer);
  };



  BlockExtractor.prototype.getNextBlock = function(cb) {
    var self = this;

    var b;
    var magic;
    async.series([
      function (a_cb) {
  
        async.whilst(
          function() {
            return (!magic);
          },
          function(w_cb) {

            self.readCurrentFileSync();

            if (self.currentFileIndex < 0) return cb();


            magic = self.currentParser ? self.currentParser.buffer(4).toString('hex')
                        : null ;

            if (!self.currentParser || self.currentParser.eof()) {
              magic = null;
              if (self.nextFile()) {
                console.log('Moving forward to file:' + self.currentFile() );
                return w_cb();
              }
              else {
                console.log('Finished all files');
                return cb();
              }
            }
            else {
              return w_cb();
            }
          }, a_cb);
      },
      function (a_cb) {
        if (magic !== self.magic) {
          var e = new Error('CRITICAL ERROR: Magic number mismatch: ' +
                    magic + '!=' + self.magic);
          return a_cb(e);
        }

        // spacer?
        self.currentParser.word32le();
        return a_cb();
      },
      function (a_cb) {
        b = new Block();
        b.parse(self.currentParser);
        b.getHash();
        return a_cb();
      },
    ], function(err) {
      return cb(err,b);
    });
  };

  return BlockExtractor;
}
module.defineClass(spec);

