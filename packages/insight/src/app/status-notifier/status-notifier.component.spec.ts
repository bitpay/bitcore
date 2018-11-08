import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusNotifierComponent } from './status-notifier.component';

describe('StatusNotifierComponent', () => {
  let component: StatusNotifierComponent;
  let fixture: ComponentFixture<StatusNotifierComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StatusNotifierComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StatusNotifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it(
    'should be able to warn the user that API failures are caused by a chain becoming unavailable'
  ); // from api/status/enabled-chains
});
