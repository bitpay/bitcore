import { async, fakeAsync, tick, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { App, Config, Form, IonicModule, Keyboard, DomController, MenuController, NavController, Platform, AlertController } from 'ionic-angular';
import { ConfigMock, PlatformMock, AlertControllerMock } from '../../mocks';
import { Page2 }      from './page2';

const alertControllerMock: AlertController = AlertControllerMock.instance();

let fixture: ComponentFixture<Page2> = null;
let instance: any = null;

let alertSpy: any;
let alertControllerSpy: any;

describe('Pages: Page2', () => {

  // demonstration on how to manually compile the test bed (as opposed to calling TestUtils)
  beforeEach(async(() => {

    TestBed.configureTestingModule({
      declarations: [Page2],
      providers: [
        App, DomController, Form, Keyboard, MenuController, NavController,
        {provide: Config, useClass: ConfigMock},
        {provide: Platform, useClass: PlatformMock},
        {provide: AlertController, useValue: alertControllerMock},
      ],
      imports: [
        FormsModule,
        IonicModule,
        ReactiveFormsModule,
      ],
    })
    .compileComponents().then(() => {
      fixture = TestBed.createComponent(Page2);
      instance = fixture;
      fixture.detectChanges();
      fixture.componentInstance.onGainChange();

      alertSpy = fixture.componentInstance.alertController;
      alertControllerSpy = fixture.componentInstance.alertController.create();

    });
  }));

  afterEach(() => {
    fixture.destroy();
  });

  it('should create page2', () => {
    expect(fixture).toBeTruthy();
    expect(instance).toBeTruthy();
  });

  it('should fire the simple alert', fakeAsync(() => {

    alertSpy.create.calls.reset();
    alertControllerSpy.present.calls.reset();

    expect(alertSpy.create).not.toHaveBeenCalledTimes(1);
    expect(alertControllerSpy.present).not.toHaveBeenCalledTimes(1);

    expect(alertSpy.create).not.toHaveBeenCalled();
    expect(alertControllerSpy.present).not.toHaveBeenCalled();

    fixture.componentInstance.showSimpleAlert();
    tick();

    expect(alertSpy.create).toHaveBeenCalledTimes(1);
    expect(alertControllerSpy.present).toHaveBeenCalledTimes(1);

    expect(alertSpy.create).toHaveBeenCalled();
    expect(alertControllerSpy.present).toHaveBeenCalled();

  }));

  it('should fire the more advanced alert', fakeAsync(() => {

    alertSpy.create.calls.reset();
    alertControllerSpy.present.calls.reset();

    fixture.componentInstance.okEd = false;

    expect(fixture.componentInstance.okEd).toBeFalsy();

    fixture.componentInstance.showMoreAdvancedAlert();
    tick();

    fixture.componentInstance.OK();

    expect(fixture.componentInstance.okEd).toBeTruthy();

  }));

});
