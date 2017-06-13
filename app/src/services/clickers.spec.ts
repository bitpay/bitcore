import { ClickersService }            from './clickers';
import { Clicker }                    from '../models';
import { StorageMock }                from './mocks';

let clickers: ClickersService = null;

describe('ClickersService', () => {

  beforeEach(() => {
    clickers = new ClickersService(<any>new StorageMock());
    spyOn(clickers['storage'], 'set').and.callThrough();
  });

  it('initialises', () => {
    expect(clickers).not.toBeNull();
  });

  it('initialises with clickers from mock storage', (done: Function) => {
    clickers['init']()
      .then(() => {
        expect(clickers.getClickers().length).toEqual(StorageMock.CLICKER_IDS.length);
        done();
      });
  });

  it('can initialise a clicker from string', () => {
    let clickerString: string = '{"id":"0g2vt8qtlm","name":"harold","clicks":[{"time":1450410168819,"location":"TODO"},{"time":1450410168945,"location":"TODO"}]}';
    let clicker: Clicker = clickers['initClicker'](clickerString);
    expect(clicker.getName()).toEqual('harold');
    expect(clicker.getCount()).toEqual(2);
  });

  it('returns undefined for a bad id', () => {
    expect(clickers.getClicker('dave')).not.toBeDefined();
  });

  it('adds a new clicker with the correct name', (done: Function) => {
    clickers['init']()
      .then(() => {
        let idAdded: string = clickers.newClicker('dave');
        expect(clickers['storage'].set).toHaveBeenCalledWith(idAdded, jasmine.any(String));
        expect(clickers.getClickers()[3].getName()).toEqual('dave');
        done();
      });
  });

  it('removes a clicker by id', () => {
    let idToRemove: string = clickers.newClicker('dave');
    clickers.removeClicker(idToRemove);
    expect(clickers['storage'].set).toHaveBeenCalledWith(idToRemove, jasmine.any(String));
  });

  it('does a click', () => {
    let idToClick: string = clickers.newClicker('dave');
    let clickedClicker: Clicker = null;
    clickers.doClick(idToClick);
    expect(clickers['storage'].set).toHaveBeenCalledWith(idToClick, jasmine.any(String));
    clickedClicker = clickers.getClicker(idToClick);
    expect(clickedClicker.getCount()).toEqual(1);
  });

  it('loads empty list if given no argument', (done: Function) => {
    clickers['initIds'](false)
      .then((ids: Array<string>) => {
        expect(ids).toEqual([]);
        done();
      });
  });

  it('loads IDs from storage', (done: Function) => {
    clickers['initIds']()
      .then((ids: Array<string>) => {
        expect(ids).toEqual(StorageMock.CLICKER_IDS);
        done();
      });
  });

  it('loads clickers from storage', (done: Function) => {
    clickers['initClickers'](StorageMock.CLICKER_IDS)
      .then((resolvedClickers: Array<Clicker>) => {
        expect(resolvedClickers.length).toEqual(3);
        expect(resolvedClickers[0].getId()).toEqual(StorageMock.CLICKER_IDS[0]);
        expect(resolvedClickers[1].getId()).toEqual(StorageMock.CLICKER_IDS[1]);
        expect(resolvedClickers[2].getId()).toEqual(StorageMock.CLICKER_IDS[2]);
        done();
      });
  });
});
