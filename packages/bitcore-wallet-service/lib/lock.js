const $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

var LocalLock = require('./locallock');
var RemoteLock = require('locker');
var Common = require('./common');
var Defaults = Common.Defaults;

var Errors = require('./errors/errordefinitions');


const ACQUIRE_RETRY_STEP = 100; //ms

var waiting = {};

function Lock(storage, opts) {
  opts = opts || {};

  this.storage = storage;
};


Lock.prototype.acquire = function(token, opts, cb, taskId) {
  var self = this;

  opts = opts || {};

  opts.lockTime = opts.lockTime ||  Defaults.LOCK_EXE_TIME;
  opts.taskId = opts.taskId ||  Math.random();

console.log('[lock.js.26:taskId:]',taskId); //TODO

  waiting[token] = waiting[token] || [];

  this.storage.acquireLock(token, (err) => {

console.log('[lock.js.39]', taskId); //TODO
    // Lock taken?
    if(err && err.message && err.message.indexOf('E11000 ') !== -1) {

      let waitTimerId;

      if (opts.waitTime) {
        waitTimerId = setTimeout(() => {
          waiting[token] = _.filter(waiting[token], (x) => { return x.task != cb; } );
          cb('Could not acquire token');
        }, opts.waitTime);
      }

console.log('[lock.js.53] PUSHED!'); //TODO
      waiting[token].push({task:cb, waitTimerId: waitTimerId});

    // Actual DB error
    } else if (err) {
      return cb(err);

    // Lock available
    } else {

      var lockTimerId;

      function release(icb) {
        if (!icb) icb = () => {};

        if (_.isEmpty(waiting[token])) {
          console.log('[lock.js.59] RELEASE LOCK', taskId); //TODO
          self.storage.releaseLock(token, icb);
        } else {

console.log('[lock.js.74] RELEASE, with next'); //TODO
          // there are fns waiting. do not release the lock yet
          let next = waiting[token].shift();
          clearTimeout(next.waitTimerId);
          clearTimeout(lockTimerId);
          console.log('[lock.js.59] CALLING NEXT'); //TODO
          return next.task(null, release);
        }
      }

      lockTimerId = setTimeout(() => { 

console.log('[lock.js.83] FORCE RELEASE', taskId); //TODO
        release(); 
      }, opts.lockTime);

      return cb(null, (icb) => {
  console.log('[lock.js.32] RELEASE FN for', taskId); //TODO
        release(icb);
      });
    }
  });
};

Lock.prototype.runLocked = function(token, opts, cb, task) {
  $.shouldBeDefined(token);

  this.acquire(token, opts, function(err, release) {
    if (err) return cb(Errors.WALLET_BUSY);
    var _cb = function() {
      cb.apply(null, arguments);
      release();
    };
    task(_cb);
  });
};


module.exports = Lock;
