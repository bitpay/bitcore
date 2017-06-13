import { ClickerApp }                      from './app.component';
import { MenuMock, NavMock, PlatformMock, SplashMock, StatusMock } from '../mocks';
import { Page2 }                           from '../pages';

let instance: ClickerApp = null;

describe('ClickerApp', () => {

  beforeEach(() => {
    instance = new ClickerApp((<any> new PlatformMock), (<any> new MenuMock), (<any>new SplashMock()), (<any>new StatusMock()));
    instance['nav'] = (<any>new NavMock());
  });

  it('initialises with two possible pages', () => {
    expect(instance['pages'].length).toEqual(2);
  });

  it('initialises with a root page', () => {
    expect(instance['rootPage']).not.toBe(null);
  });

  it('opens a page', () => {
    spyOn(instance['menu'], 'close');
    spyOn(instance['nav'], 'setRoot');
    instance.openPage(instance['pages'][1]);
    expect(instance['menu']['close']).toHaveBeenCalled();
    expect(instance['nav'].setRoot).toHaveBeenCalledWith(Page2);
  });
});
