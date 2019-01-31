/* tslint:disable:no-console */
import { Injectable, isDevMode } from '@angular/core';
import * as _ from 'lodash';

@Injectable()
export class Logger {
  public levels;
  public weight;

  constructor() {
    this.levels = [
      { level: 'error', weight: 1, label: 'Error', def: false },
      { level: 'warn', weight: 2, label: 'Warning', def: false },
      { level: 'info', weight: 3, label: 'Info', def: true },
      { level: 'debug', weight: 4, label: 'Debug', def: false }
    ];

    // Create an array of level weights for performant filtering.
    this.weight = {};
    for (const i of this.levels) {
      if (this.levels[i]) {
        this.weight[this.levels[i].level] = this.levels[i].weight;
      }
    }
  }

  private getMessage(message): string {
    const isUndefined = _.isUndefined(message);
    const isNull = _.isNull(message);
    const isError = _.isError(message);
    const isObject = _.isObject(message);
    if (isUndefined) {
      return 'undefined';
    } else if (isNull) {
      return 'null';
    } else if (isError) {
      return message.message;
    } else if (isObject) {
      return JSON.stringify(message);
    } else {
      return message;
    }
  }

  public error(_message?, ..._optionalParams): void {
    const type = 'error';
    const args = this.processingArgs(arguments);
    this.log(`[${type}] ${args}`);
  }

  public debug(_message?, ..._optionalParams): void {
    const type = 'debug';
    const args = this.processingArgs(arguments);
    if (isDevMode()) {
      this.log(`[${type}] ${args}`);
    }
  }

  public info(_message?, ..._optionalParams): void {
    const type = 'info';
    const args = this.processingArgs(arguments);
    if (isDevMode()) {
      this.log(`[${type}] ${args}`);
    }
  }

  public warn(_message?, ..._optionalParams): void {
    const type = 'warn';
    const args = this.processingArgs(arguments);
    if (isDevMode()) {
      this.log(`[${type}] ${args}`);
    }
  }

  public getLevels() {
    return this.levels;
  }

  public getWeight(weight) {
    return _.find(this.levels, l => {
      return l.weight === weight;
    });
  }

  public getDefaultWeight() {
    return _.find(this.levels, l => {
      return l.def;
    });
  }

  public processingArgs(argsValues) {
    let args = Array.prototype.slice.call(argsValues);
    args = args.map(v => {
      try {
        v = this.getMessage(v);
      } catch (e) {
        console.log('Error at log decorator:', e);
        v = 'Unknown message';
      }
      return v;
    });
    return args.join(' ');
  }

  public log(msg: string, ...optionalParams) {
    console.log(msg, ...optionalParams);
  }
}
