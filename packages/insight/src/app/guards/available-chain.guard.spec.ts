import { async, inject, TestBed } from '@angular/core/testing';

import { AvailableChainGuard } from './available-chain.guard';

describe('AvailableChainGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AvailableChainGuard]
    });
  });

  it('should ...', inject(
    [AvailableChainGuard],
    (guard: AvailableChainGuard) => {
      expect(guard).toBeTruthy();
    }
  ));
});
