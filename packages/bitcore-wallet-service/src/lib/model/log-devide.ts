import _ from 'lodash';

const Uuid = require('uuid');
const Defaults = require('../common/defaults');

const MAX_ATTENDANCE_WEEK = 7;

export interface ILogDevice {
  id: number;
  version: number;
  createdOn: number;
  updatedOn: number;
  platform: string;
  packageName: string;
  token: string;
  deviceId: string;
  location: string;
  isFirstInstall: boolean;
  countNumber: number;
}
export class LogDevice {
  id: number;
  version: number;
  createdOn: number;
  updatedOn: number;
  platform: string;
  packageName: string;
  token: string;
  deviceId: string;
  location: string;
  isFirstInstall: boolean;
  countNumber: number;

  static create(opts) {
    opts = opts || {};

    const now = Math.floor(Date.now() / 1000);

    const x = new LogDevice();

    x.id = Uuid.v4();
    x.version = 1;
    x.createdOn = now;
    x.updatedOn = now;
    x.platform = opts.platform;
    x.packageName = opts.packageName;
    x.token = opts.token;
    x.deviceId = opts.deviceId;
    x.location = opts.location;
    x.isFirstInstall = false;
    x.countNumber = 0;

    return x;
  }

  static fromObj(obj) {
    const x = new LogDevice();

    x.id = obj.id;
    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.updatedOn = obj.updatedOn;
    x.platform = obj.platform;
    x.packageName = obj.packageName;
    x.token = obj.token;
    x.deviceId = obj.deviceId;
    x.location = obj.location;
    x.isFirstInstall = obj.isFirstInstall;
    x.countNumber = obj.countNumber;

    return x;
  }

  toObject() {
    return this;
  }

  isValid() {
    const now = Math.floor(Date.now() / 1000);
    return now - this.updatedOn <= Defaults.SESSION_EXPIRATION;
  }

  touch() {
    const now = Math.floor(Date.now() / 1000);
    this.updatedOn = now;
  }

  attendance() {
    const attendance = this.countNumber + 1;
    if (attendance > MAX_ATTENDANCE_WEEK) return;
    this.countNumber = attendance;
  }
}
