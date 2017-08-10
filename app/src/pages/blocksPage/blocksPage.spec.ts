import { ComponentFixture, async }    from '@angular/core/testing';
import { TestUtils }                  from '../../test';
import { BlocksPage }                from './blocksPage';

let fixture: ComponentFixture<BlocksPage> = null;
let instance: any = null;

describe('Blocks', () => {

  beforeEach(async(() => TestUtils.beforeEachCompiler([BlocksPage]).then(compiled => {
    fixture = compiled.fixture;
    instance = compiled.instance;
    fixture.detectChanges();
  })));

  afterEach(() => {
    fixture.destroy();
  });

  it('initializes', () => {
    expect(instance).toBeTruthy();
  });

  /*
  it('has a search method', () => {
    spyOn(instance, 'search');
    instance.search();
    expect(instance.search).toHaveBeenCalled();
  });
   */
});
