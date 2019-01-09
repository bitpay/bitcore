const $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

var Common = require('./common');
var Defaults = Common.Defaults;

var Errors = require('./errors/errordefinitions');


const ACQUIRE_RETRY_STEP = 100; //ms

var waiting = {};

function Lock(storage, opts) {
  opts = opts || {};

  this.storage = storage;
};


Lock.prototype.acquire = function(token, opts, cb) {
  var self = this;
  opts = opts || {};

  opts.lockTime = opts.lockTime ||  Defaults.LOCK_EXE_TIME;
  waiting[token] = waiting[token] || [];

  this.storage.acquireLock(token, (err) => {

    // Lock taken?
    if(err && err.message && err.message.indexOf('E11000 ') !== -1) {

console.log('[lock.js.35] LOCKED! waiting', token); //TODO
      let waitTimerId;

      if (opts.waitTime) {
        waitTimerId = setTimeout(() => {
          waiting[token] = _.filter(waiting[token], (x) => { return x.task != cb; } );
          cb('Could not acquire token');
        }, opts.waitTime);
      }

      waiting[token].push({task:cb, waitTimerId: waitTimerId});

    // Actual DB error
    } else if (err) {
      return cb(err);

    // Lock available
    } else {

      var lockTimerId;

      console.log('[lock.js.35] taking', token); //TODO
      function release(icb) {
        if (!icb) icb = () => {};

        if (_.isEmpty(waiting[token])) {


          console.log('[lock.js.61] RELEASING!', token); //TODO
          self.storage.releaseLock(token, () => {

            icb();

console.log('[lock.js.70:waiting:]',waiting); //TODO
            let arrivals = _.clone(waiting[token]);
            waiting[token]=[];
            // Did someone arrived?
            _.each(arrivals, (x) => {

console.log('[lock.js.74] RESTARTING!'); //TODO
              self.acquire(token, opts, x.task);
            });

          });
        } else {
console.log('[lock.js.61] NEXT!!', token); //TODO

          // there are fns waiting. do not release the lock yet
          let next = waiting[token].shift();
          clearTimeout(next.waitTimerId);
          clearTimeout(lockTimerId);
          return next.task(null, release);
        }
      }

      lockTimerId = setTimeout(() => { 

        release(); 
      }, opts.lockTime);

      return cb(null, (icb) => {
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
