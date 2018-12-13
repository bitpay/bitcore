/* tslint:disable:no-unused-variable */
import { inject, TestBed } from '@angular/core/testing';
import { HttpModule } from '@angular/http';
import { ApiProvider } from '../api/api';
import { DefaultProvider } from '../default/default';

describe('ApiProvider', () => {
  let api: ApiProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpModule],
      providers: [ApiProvider, DefaultProvider]
    });
  });

  beforeEach(inject([ApiProvider], provider => {
    api = provider;
  }));

  it('initializes', () => {
    expect(api).not.toBeNull();
  });
});
