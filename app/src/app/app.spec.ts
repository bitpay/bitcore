import { InsightApp } from './app.component';
import { MenuMock, NavMock, PlatformMock, SplashMock, StatusMock } from '../mocks';
import { BroadcastTxPage } from '../pages';

let instance: InsightApp = null;

describe('InsightApp', () => {

  beforeEach(() => {
    instance = new InsightApp((<any> new PlatformMock), (<any> new MenuMock), (<any>new SplashMock()), (<any>new StatusMock()));
    instance['nav'] = (<any>new NavMock());
  });

  it('initializes with four possible pages', () => {
    expect(instance['pages'].length).toEqual(4);
  });

  it('initializes with a root page', () => {
    expect(instance['rootPage']).not.toBe(null);
  });

  it('opens a page', () => {
    spyOn(instance['menu'], 'close');
    spyOn(instance['nav'], 'setRoot');
    instance.openPage(instance['pages'][1]);
    expect(instance['menu']['close']).toHaveBeenCalled();
    expect(instance['nav'].setRoot).toHaveBeenCalledWith(BroadcastTxPage);
  });
});
