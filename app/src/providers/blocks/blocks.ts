import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../../providers/api/api';

/*
  Generated class for the BlocksProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class BlocksProvider {

  constructor(public http: Http, private api: ApiProvider) {
  }

  public getBlocks(): any {
    return this.http.get(this.api.apiPrefix + 'blocks');
  }

}
