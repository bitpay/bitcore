/* tslint:disable:no-unused-variable */
import { TestBed, ComponentFixture, inject } from '@angular/core/testing';
import { HttpModule } from '@angular/http';
import { CurrencyProvider } from './currency';
import { ApiProvider } from '../api/api';
import { DefaultProvider } from '../default/default';

describe('CurrencyProvider', () => {
  let currency: CurrencyProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpModule],
      providers: [ApiProvider, CurrencyProvider, DefaultProvider]
    });
  });

  beforeEach(inject([CurrencyProvider], provider => {
    currency = provider;
  }));

  it('initialises', () => {
    expect(currency).not.toBeNull();
    expect(currency.defaultCurrency).toBe('BTC');
    expect(currency.currencySymbol).toBe('BTC');
    expect(currency.factor).toBe(1);
  });

  it('sets currency by updating the symbol and changing the multiplication factor', () => {
    currency.setCurrency('USD');
    expect(currency.currencySymbol).toBe('USD');
    expect(currency.factor).toEqual(1);

    currency.setCurrency('BTC');
    expect(currency.currencySymbol).toBe('BTC');
    expect(currency.factor).toEqual(1);

    currency.setCurrency('mBTC');
    expect(currency.currencySymbol).toBe('mBTC');
    expect(currency.factor).toEqual(1000);

    currency.setCurrency('bits');
    expect(currency.currencySymbol).toBe('bits');
    expect(currency.factor).toEqual(1000000);
  });

  it('rounds float using specified number of decimal places', () => {
    let aFloat: number = 4.32943;

    expect(currency.roundFloat(aFloat, 2)).toBe(4.33);
    expect(currency.roundFloat(aFloat, 3)).toBe(4.329);
    expect(currency.roundFloat(aFloat, 4)).toBe(4.3294);
    expect(currency.roundFloat(aFloat, 5)).toBe(4.32943);

    aFloat = 1234567890.09876543;

    expect(currency.roundFloat(aFloat, 2)).toBe(1234567890.1);
    expect(currency.roundFloat(aFloat, 3)).toBe(1234567890.099);
    expect(currency.roundFloat(aFloat, 4)).toBe(1234567890.0988);
    expect(currency.roundFloat(aFloat, 5)).toBe(1234567890.09877);
    expect(currency.roundFloat(aFloat, 6)).toBe(1234567890.098765);
    expect(currency.roundFloat(aFloat, 7)).toBe(1234567890.0987654);
    expect(currency.roundFloat(aFloat, 8)).toBe(1234567890.09876543);
  });

  it('gets proper conversion after changing currency', () => {
    let aFloat: number = 12345.09876543;
    expect(currency.getConversion(aFloat)).toBe('12345.09876543 BTC');

    currency.setCurrency('mBTC');
    expect(currency.getConversion(aFloat)).toBe('12345098.76543 mBTC');

    currency.setCurrency('bits');
    expect(currency.getConversion(aFloat)).toBe('12345098765.43 bits');
  });
});
