import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockListComponent } from './block-list.component';

describe('BlockListComponent', () => {
  let component: BlockListComponent;
  let fixture: ComponentFixture<BlockListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BlockListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BlockListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
