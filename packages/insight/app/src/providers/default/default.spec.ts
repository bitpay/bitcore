/* tslint:disable:no-unused-variable */
import { TestBed, ComponentFixture, inject } from '@angular/core/testing';
import { HttpModule } from '@angular/http';
import { DefaultProvider } from './default';

describe('DefaultProvider', () => {
  let defaults: DefaultProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpModule
      ],
      providers: [
        DefaultProvider
      ]
    });
  });

  beforeEach(inject([DefaultProvider], provider => {
    defaults = provider;
  }));

  it('initializes', () => {
    expect(defaults).not.toBeNull();
  });

  it('has defaults', () => {
    expect(defaults.getDefault('%DEFAULT_CURRENCY%')).toBe('BTC');
    expect(defaults.getDefault('%API_PREFIX%')).toBe('/api');
    expect(defaults.getDefault('%NETWORK%')).toBe('regtest');
  });
});
