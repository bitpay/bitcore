import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { LoggerTestingModule } from 'ngx-logger';
import { CurrencyValueComponent } from './currency-value.component';

describe('CurrencyValueComponent', () => {
  let component: CurrencyValueComponent;
  let fixture: ComponentFixture<CurrencyValueComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CurrencyValueComponent],
      imports: [LoggerTestingModule]
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

  it('should not display anything while loading rates');
  it('should indicate if the value is an approximation');
  it('should display bits using two decimals');
  it('should display satoshis using eight decimals');
  it('should only display currency symbols for USD, EUR, GBP, and CNY');
  it('should convert between denominations of the same chain');
  it('should convert between denominations of different chains');
  it('should show an error when `displayAs` is not supported by the rates API');
});
