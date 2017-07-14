import { ComponentFixture, async }    from '@angular/core/testing';
import { TestUtils }                  from '../../test';
import { BroadcastTxPage }                from './broadcastTxPage';

let fixture: ComponentFixture<BroadcastTxPage> = null;
let instance: any = null;

describe('BroadcastTxPage', () => {

  beforeEach(async(() => TestUtils.beforeEachCompiler([BroadcastTxPage]).then(compiled => {
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

  it('has a send method', () => {
    spyOn(instance, 'send');
    instance.send();
    expect(instance.send).toHaveBeenCalled();
  });
});
