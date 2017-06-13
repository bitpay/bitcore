'use strict';

import { Clicker } from './clicker';

describe('Clicker', () => {

  it('initialises with the correct name', () => {
    let clicker: Clicker = new Clicker('12434', 'testClicker');
    expect(clicker.getName()).toEqual('testClicker');
  });
});
