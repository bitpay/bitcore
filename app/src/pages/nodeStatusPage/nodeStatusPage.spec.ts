import { ComponentFixture, async }    from '@angular/core/testing';
import { TestUtils }                  from '../../test';
import { NodeStatusPage }                from './nodeStatusPage';

let fixture: ComponentFixture<NodeStatusPage> = null;
let instance: any = null;

describe('NodeStatusPage', () => {

  beforeEach(async(() => TestUtils.beforeEachCompiler([NodeStatusPage]).then(compiled => {
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
});
