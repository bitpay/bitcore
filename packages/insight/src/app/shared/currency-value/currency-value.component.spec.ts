import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CurrencyValueComponent } from './currency-value.component';

describe('CurrencyUnitsComponent', () => {
  let component: CurrencyValueComponent;
  let fixture: ComponentFixture<CurrencyValueComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CurrencyValueComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CurrencyValueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
