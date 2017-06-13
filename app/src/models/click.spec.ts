'use strict';

import { Click } from './click';

describe('Click', () => {

  it('initialises with defaults', () => {
    let click: Click = new Click();

    // toString() prints out something like "Thu Jan 07 2016 14:05:14 GMT+1300 (NZDT)"
    // comparing millis directly sometimes fails test (as it will be one milli too late!)
    let currentDateString: string = new Date().toString();
    let defaultDateString: string = new Date(click.getTime()).toString();

    expect(currentDateString).toEqual(defaultDateString);
    expect(click.getLocation()).toEqual('TODO');
  });

  it('initialises with overrides', () => {
    let current: number = new Date().getTime();
    let location: string = 'MY LOCATION';
    let click: Click = new Click(current, location);
    expect(click.getTime()).toEqual(current);
    expect(click.getLocation()).toEqual(location);
  });
});
