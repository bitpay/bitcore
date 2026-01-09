import { Common } from './common';
import { Errors } from './errors/errordefinitions';
import { Storage } from './storage';

const Defaults = Common.Defaults;
const ACQUIRE_RETRY_STEP = 50; // ms

interface ILockOptions {
  /** 
   * Maximum time (in ms) to hold the lock after which it'll automatically release.
   * Default: Defaults.LOCK_EXE_TIME (ms)
   */
  lockTime?: number;
  /**
   * Time (in ms) you're willing to wait if a lock is already held by someone else.
   * Default: 50
   */
  waitTime?: number;
};

type LockOpts = ILockOptions | null | undefined;

export class Lock {
  storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  /**
   * Acquire a database lock for a given token
   * @param {string} token The key to lock on
   * @param {ILockOptions | null | undefined} opts Options for the lock
   * @param {Function} cb Callback function that takes an error and a lock release (LR) function. The LR function itself takes an optional callback
   * @param {number} [timeLeft] Internal parameter to track time left when retrying to acquire the lock
   * 
   * @example
   * lock.acquire('mylock', null, function(err, release) {
   *   // We have the lock! Do stuff...
   *   
   *   release(function() {
   *     // Lock released. Carry on...
   *  
   *   });
   * });
   */
  acquire(token: string, opts: LockOpts, cb: (err: any, release?: (cb?: () => void) => void) => void, timeLeft?: number) {
    opts = opts || {};

    opts.lockTime = opts.lockTime || Defaults.LOCK_EXE_TIME;

    this.storage.acquireLock(token, Date.now() + opts.lockTime, err => {
      if (err) {
        // Lock already exists?
        if (err.message?.indexOf('E11000 ') !== -1) {
          // Existing lock expired?
          this.storage.clearExpiredLock(token, () => {});
          // Waiting time for lock has expired
          if (timeLeft < 0) {
            return cb('LOCKED');
          }

          if (opts.waitTime != null) {
            timeLeft = timeLeft == null ? opts.waitTime : (timeLeft - ACQUIRE_RETRY_STEP);
          }

          return setTimeout(this.acquire.bind(this, token, opts, cb, timeLeft), ACQUIRE_RETRY_STEP);
        }
        // Actual DB error
        return cb(err);
      }
      // Lock available
      return cb(null, /* release function: */ icb => {
        if (!icb) icb = () => {};
        this.storage.releaseLock(token, icb);
      });
    });
  }

  /**
   * Run a function while holding a lock and automatically release the lock when the callback is finished
   * @param {string} token The key to lock on
   * @param {ILockOptions | null | undefined} opts Options for the lock
   * @param {Function} cb Callback function that take an error and a lock release function
   * @param {Function} task The function to run while holding the lock
   * 
   * @example
   * lock.runLocked('mylock', null, function(err) {
   *     // Uh-oh, lock could not be acquired. Short circuit.
   *   }, function(done) {
   *    // We have the lock! Do stuff...
   *    
   *    done();
   *   }
   * });
   */
  runLocked(token: string, opts: LockOpts, cb: (...args: any) => void, task: (cb: (...args: any) => void) => void) {
    if (!token) {
      return cb(new Error('Failed state: token undefined at <runLocked()>'));
    }

    this.acquire(token, opts, (err, release) => {
      if (err == 'LOCKED') return cb(Errors.WALLET_BUSY);
      if (err) return cb(err);

      task(function(...args) {
        cb(...args);
        release();
      });
    });
  }
}
