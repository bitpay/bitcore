/* tslint:disable */
// IONIC:
import { EventEmitter } from '@angular/core';
import { FormBuilder } from '@angular/forms';

// from
// https://github.com/stonelasley/ionic-mocks/
// should the package be incorporated?

declare var jasmine: any;

export class AlertMock {
  public static instance(): any {
    let instance = jasmine.createSpyObj('Alert', ['present', 'dismiss']);
    instance.present.and.returnValue(Promise.resolve());
    instance.dismiss.and.returnValue(Promise.resolve());

    return instance;
  }
}

export class AlertControllerMock {
  public static instance(alertMock?: AlertMock): any {
    let instance = jasmine.createSpyObj('AlertController', ['create']);
    instance.create.and.returnValue(alertMock || AlertMock.instance());

    return instance;
  }
}

export class ToastMock {
  public create(): any {
    let rtn: Object = {};
    rtn['present'] = () => true;
    return rtn;
  }
}

export class ConfigMock {
  public get(): any {
    return '';
  }

  public getBoolean(): boolean {
    return true;
  }

  public getNumber(): number {
    return 1;
  }

  public setTransition(): void {
    return;
  }
}

export class FormMock {
  public register(): any {
    return true;
  }
}

export class NavMock {
  public pop(): any {
    return new Promise(function(resolve: Function): void {
      resolve();
    });
  }

  public push(): any {
    return new Promise(function(resolve: Function): void {
      resolve();
    });
  }

  public getActive(): any {
    return {
      instance: {
        model: 'something'
      }
    };
  }

  public setRoot(): any {
    return true;
  }

  public popToRoot(): any {
    return true;
  }
}

export class PlatformMock {
  public ready(): Promise<String> {
    return new Promise(resolve => {
      resolve('READY');
    });
  }

  public registerBackButtonAction(fn: Function, priority?: number): Function {
    return () => true;
  }

  public hasFocus(ele: HTMLElement): boolean {
    return true;
  }

  public doc(): HTMLDocument {
    return document;
  }

  public is(): boolean {
    return true;
  }

  public getElementComputedStyle(container: any): any {
    return {
      paddingLeft: '10',
      paddingTop: '10',
      paddingRight: '10',
      paddingBottom: '10'
    };
  }

  public onResize(callback: any) {
    return callback;
  }

  public registerListener(
    ele: any,
    eventName: string,
    callback: any
  ): Function {
    return () => true;
  }

  public win(): Window {
    return window;
  }

  public raf(callback: any): number {
    return 1;
  }

  public timeout(callback: any, timer: number): any {
    return setTimeout(callback, timer);
  }

  public cancelTimeout(id: any) {
    // do nothing
  }

  public getActiveElement(): any {
    return document['activeElement'];
  }
}

export class SplashMock {
  public hide() {
    return Promise.resolve(true);
  }
}

export class StatusMock {
  public styleDefault() {
    return Promise.resolve(true);
  }
}

export class MenuMock {
  public close(): any {
    return new Promise((resolve: Function) => {
      resolve();
    });
  }
}

export class AppMock {
  public getActiveNav(): NavMock {
    return new NavMock();
  }
}

/* tslint:enable */
