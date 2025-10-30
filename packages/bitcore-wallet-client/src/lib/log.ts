const DEFAULT_LOG_LEVEL = 'silent';

const levels = {
  silent: -1,
  debug: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

class Logger {
  name: string;
  level = DEFAULT_LOG_LEVEL;

  /**
   * A simple logger that wraps the console.log methods when available.
   * 
   * Usage:
   * <pre>
   *   log = new Logger('copay');
   *   log.setLevel('info');
   *   log.debug('Message!'); // won't show
   *   log.setLevel('debug');
   *   log.debug('Message!', 1); // will show '[debug] copay: Message!, 1'
   * </pre>
   * 
   * @param {string} name A name for the logger. This will show up on every log call
   */
  constructor(name) {
    this.name = name || 'log';

    for (const [levelName, level] of Object.entries(levels)) {
      // dont create a this.silent() method
      if (levelName === 'silent') { continue; }

      this[levelName] = function(...args) {
        if (this.level === 'silent') return;
    
        if (level >= levels[this.level]) {
          let caller;

          if (Error.stackTraceLimit && this.level == 'debug') {
            const old = Error.stackTraceLimit;
            Error.stackTraceLimit = 2;
            let stack;

            // this hack is to be compatible with IE11
            try {
              console.trace();
            } catch (e) {
              stack = e.stack;
            }
            if (stack) {
              const lines = stack.split('\n');
              caller = lines[2];
              caller = ':' + caller.substr(6);
            }
            Error.stackTraceLimit = old;
          }
    
          let str = '[' + levelName + (caller || '') + '] ' + args[0];
          const extraArgs = args.slice(1);
          if (console[levelName]) {
            extraArgs.unshift(str);
            console[levelName](...extraArgs);
          } else {
            if (extraArgs.length) {
              str += JSON.stringify(extraArgs);
            }
            console.log(str);
          }
        }
      };
    }
  }

  static getLevels() {
    return levels;
  }

  getLevels() {
    return Logger.getLevels();
  }

  /**
   * Sets the level of a logger. A level can be any between: 'debug', 'info', 'log',
   * 'warn', 'error', and 'fatal'. That order matters: if a logger's level is set to
   * 'warn', calling <tt>level.debug</tt> won't have any effect.
   *
   * @param {string} level - the name of the logging level
   */
  setLevel(level) {
    this.level = level;
    return this;
  }

  private _baseLog(levelName, ...args) {
    if (this.level === 'silent') return;

    const level = levels[levelName];

    if (level >= levels[this.level]) {
      let caller;

      if (Error.stackTraceLimit && this.level == 'debug') {
        const old = Error.stackTraceLimit;
        Error.stackTraceLimit = 2;
        let stack;

        // this hack is to be compatible with IE11
        try {
          console.trace();
        } catch (e) {
          stack = e.stack;
        }
        if (stack) {
          const lines = stack.split('\n');
          caller = lines[2];
          caller = ':' + caller.substr(6);
        }
        Error.stackTraceLimit = old;
      }

      let str = '[' + levelName + (caller || '') + '] ' + args[0];
      const extraArgs = args.slice(1);
      if (console[levelName]) {
        extraArgs.unshift(str);
        console[levelName](...extraArgs);
      } else {
        if (extraArgs.length) {
          str += JSON.stringify(extraArgs);
        }
        console.log(str);
      }
    }
    return this;
  }

  debug(...args) { return this._baseLog('debug', ...args); }
  info(...args) { return this._baseLog('info', ...args); }
  log(...args) { return this._baseLog('log', ...args); }
  warn(...args) { return this._baseLog('warn', ...args); }
  error(...args) { return this._baseLog('error', ...args); }
  fatal(...args) { return this._baseLog('fatal', ...args); }
};

export default new Logger('copay');