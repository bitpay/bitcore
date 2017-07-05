import { ComponentFixture, async }    from '@angular/core/testing';
import { TestUtils }                  from '../../test';
import { VerifyMessagePage }                from './verifyMessagePage';

let fixture: ComponentFixture<VerifyMessagePage> = null;
let instance: any = null;

describe('VerifyMessagePage', () => {

  beforeEach(async(() => TestUtils.beforeEachCompiler([VerifyMessagePage]).then(compiled => {
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
