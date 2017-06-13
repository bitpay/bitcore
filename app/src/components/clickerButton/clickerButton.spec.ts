import { ComponentFixture, async } from '@angular/core/testing';
import { TestUtils }               from '../../test';
import { ClickerButton }           from './clickerButton';
import { ClickerMock }             from '../../models/clicker.mock';

let fixture: ComponentFixture<ClickerButton> = null;
let instance: any = null;

describe('ClickerButton', () => {

  beforeEach(async(() => TestUtils.beforeEachCompiler([ClickerButton]).then(compiled => {
    fixture = compiled.fixture;
    instance = compiled.instance;
    instance.clicker = new ClickerMock();
  })));

  afterEach(() => {
    fixture.destroy();
  });

  it('initialises', () => {
    expect(instance).not.toBeNull();
  });

  it('displays the clicker name and count', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.button-inner')[0].innerHTML).toEqual('TEST CLICKER (10)');
  });

  it('does a click', () => {
    fixture.detectChanges();
    spyOn(instance['clickerService'], 'doClick');
    TestUtils.eventFire(fixture.nativeElement.querySelectorAll('button')[0], 'click');
    expect(instance['clickerService'].doClick).toHaveBeenCalled();
  });
});
