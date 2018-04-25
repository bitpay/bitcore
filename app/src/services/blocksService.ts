import { Http, Response } from '@angular/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Block, InsightBlockObject } from '../models';

/**
 * @deprecated use BlocksProvider
 */
@Injectable()
export class BlocksService {

  public readonly latestBlocks: Subject<Array<Block>> = new Subject();

  constructor(private http: Http) {}

  public getLatestBlocks(): void {
    this.http.request('/api/blocks').subscribe((res: Response) => {
      const data: {
        blocks: InsightBlockObject[],
        length: number,
        pagination: {}
      } = res.json();
      this.latestBlocks.next(data.blocks.map((obj) => {
        return new Block(obj);
      }));
    });
  }

}
