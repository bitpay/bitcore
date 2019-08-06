/* tslint:disable:no-unused-variable */
import { inject, TestBed } from '@angular/core/testing';
import { HttpModule } from '@angular/http';
import { DefaultProvider } from './default';

describe('DefaultProvider', () => {
  let defaults: DefaultProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpModule],
      providers: [DefaultProvider]
    });
  });

  beforeEach(inject([DefaultProvider], provider => {
    defaults = provider;
  }));

  it('initializes', () => {
    expect(defaults).not.toBeNull();
  });

  it('has defaults', () => {
    expect(defaults.getDefault('%CHAIN%')).toBe('BTC');
    expect(defaults.getDefault('%API_PREFIX%')).toBe('/api');
    expect(defaults.getDefault('%NETWORK%')).toBe('regtest');
  });
});
