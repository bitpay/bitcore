import { Subject } from 'rxjs';
import { Block } from '../models';

export class BlocksServiceMock {

  public readonly latestBlocks: Subject<Array<Block>> = new Subject();

  public getLatestBlocks(): void {
    this.latestBlocks.next([
      new Block({
        height: 474504,
        size: 998221,
        hash: '000000000000000001763ebcea127d82b5c49b620960e2d881c4ace719d5fe46',
        time: 1499346191,
        txlength: 1904,
        poolInfo: {
          poolName: 'AntMiner',
          url: 'https://bitmaintech.com/'
        }
      })
    ]);
  }

}
