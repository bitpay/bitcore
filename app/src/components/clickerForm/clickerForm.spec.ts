import { FormBuilder }             from '@angular/forms';
import { ComponentFixture, async } from '@angular/core/testing';
import { TestUtils }               from '../../test';
import { ClickerForm }             from './clickerForm';

let fixture: ComponentFixture<ClickerForm> = null;
let instance: any = null;

describe('ClickerForm', () => {

  beforeEach(async(() => TestUtils.beforeEachCompiler([ClickerForm]).then(compiled => {
    fixture = compiled.fixture;
    instance = compiled.instance;
    instance.clicker = { name: 'TEST CLICKER' };
    instance.clicker.getCount = function(): number { return 10; };
    fixture.autoDetectChanges(true);
  })));

  afterEach(() => {
    fixture.destroy();
  });

  it('initialises', () => {
    expect(fixture).not.toBeNull();
    expect(instance).not.toBeNull();
  });

  it('passes new clicker through to service', () => {
    let clickerName: string = 'dave';
    instance.form = new FormBuilder().group({clickerNameInput: [clickerName]});
    spyOn(instance, 'newClicker').and.callThrough();
    spyOn(instance['clickerService'], 'newClicker').and.callThrough();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('button')[1].click();
    expect(instance.newClicker).toHaveBeenCalledWith(Object({ clickerNameInput: clickerName }));
    expect(instance['clickerService'].newClicker).toHaveBeenCalledWith(clickerName);
  });

  it('doesn\'t try to add a clicker with no name', () => {
    spyOn(instance['clickerService'], 'newClicker').and.callThrough();
    instance.newClicker({});
    expect(instance['clickerService'].newClicker).not.toHaveBeenCalled();
  });
});
