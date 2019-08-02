// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/dist/async-test';
import 'zone.js/dist/fake-async-test';
import 'zone.js/dist/jasmine-patch';
import 'zone.js/dist/long-stack-trace-zone';
import 'zone.js/dist/proxy.js';
import 'zone.js/dist/sync-test';

import { HttpClientModule } from '@angular/common/http';
import { getTestBed, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
// import { MockBackend } from '@angular/http/testing';
import {
  ActionSheetController,
  App,
  Config,
  DomController,
  Form,
  GestureController,
  IonicModule,
  Keyboard,
  MenuController,
  NavController,
  Platform
} from 'ionic-angular';
import { ConfigMock, PlatformMock } from './mocks';
import { ApiProvider } from './providers/api/api';
import { CurrencyProvider } from './providers/currency/currency';

// Unfortunately there's no typing for the `__karma__` variable. Just declare it as any.
declare var __karma__: any;
declare var require: any;

// Prevent Karma from running prematurely.
__karma__.loaded = () => {
  // noop
};

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
// Then we find all the tests.
const context: any = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
// Finally, start Karma to run the tests.
__karma__.start();

export class TestUtils {
  public static beforeEachCompiler(
    components: any[]
  ): Promise<{ fixture: any; instance: any }> {
    return TestUtils.configureIonicTestingModule(components)
      .compileComponents()
      .then(() => {
        const fixture: any = TestBed.createComponent(components[0]);
        return {
          fixture,
          instance: fixture.debugElement.componentInstance
        };
      });
  }

  public static configureIonicTestingModule(components: any[]): typeof TestBed {
    return TestBed.configureTestingModule({
      declarations: [...components],
      providers: [
        App,
        Form,
        Keyboard,
        DomController,
        MenuController,
        NavController,
        GestureController,
        { provide: Platform, useClass: PlatformMock },
        { provide: Config, useClass: ConfigMock },
        ApiProvider,
        CurrencyProvider,
        ActionSheetController
      ],
      imports: [FormsModule, IonicModule, ReactiveFormsModule, HttpClientModule]
    });
  }

  // http://stackoverflow.com/questions/2705583/how-to-simulate-a-click-with-javascript
  public static eventFire(el: any, etype: string): void {
    if (el.fireEvent) {
      el.fireEvent('on' + etype);
    } else {
      const evObj: any = document.createEvent('Events');
      evObj.initEvent(etype, true, false);
      el.dispatchEvent(evObj);
    }
  }
}
