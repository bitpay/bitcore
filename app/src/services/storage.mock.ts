'use strict';

export class StorageMock {

  public static CLICKER_IDS: Array<string> = ['yy5d8klsj0', 'q20iexxg4a', 'wao2xajl8a'];

  public get(key: string): Promise<{}> {
    let rtn: string = null;

    switch (key) {
      case 'ids':
        rtn = JSON.stringify(StorageMock.CLICKER_IDS);
        break;
      case StorageMock.CLICKER_IDS[0]:
        rtn = `{"id":"${StorageMock.CLICKER_IDS[0]}","name":"test1","clicks":[{"time":1450410168819,"location":"TODO"}]}`;
        break;
      case StorageMock.CLICKER_IDS[1]:
        rtn = `{"id":"${StorageMock.CLICKER_IDS[1]}","name":"test2","clicks":[{"time":1450410168819,"location":"TODO"},{"time":1450410168945,"location":"TODO"}]}`;
        break;
      case StorageMock.CLICKER_IDS[2]:
        rtn = `{"id":"${StorageMock.CLICKER_IDS[2]}","name":"test3", "clicks":[{ "time": 1450410168819, "location": "TODO" }, { "time": 1450410168945, "location": "TODO" }] }`;
        break;
      default:
        rtn = 'SHOULD NOT BE HERE!';
    }

    return new Promise((resolve: Function) => {
      resolve(rtn);
    });
  }

  public set(key: string, value: string): Promise<{}> {
    return new Promise((resolve: Function) => {
      resolve({key: key, value: value});
    });
  }

  public remove(key: string): Promise<{}> {
    return new Promise((resolve: Function) => {
      resolve({key: key});
    });
  }
}
