import { InsightApp } from './app.component';
import { TestBed, getTestBed } from '@angular/core/testing';
import { Platform } from 'ionic-angular';
import { NavMock } from '../mocks';
import { PopoverController, MenuController } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';

describe('InsightApp', () => {
  let injector: TestBed;
  let app: InsightApp;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PopoverController,
        InsightApp,
        Platform,
        MenuController,
        SplashScreen,
        StatusBar
      ]
    });
    injector = getTestBed();
    app = injector.get(InsightApp);

    app['nav'] = (<any>new NavMock());
  });

  it('initializes with three possible pages', () => {
    expect(app['pages'].length).toEqual(3);
  });

  it('initializes with a root page', () => {
    expect(app['rootPage']).not.toBe(null);
  });

  it('opens a page', () => {
    spyOn(app['menu'], 'close');
    spyOn(app['nav'], 'setRoot');
    app.openPage(app['pages'][1]);
    expect(app['menu']['close']).toHaveBeenCalled();
  });
});
