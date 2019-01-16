import { Injectable } from '@angular/core';
import { Events } from 'ionic-angular';

@Injectable()
export class RedirProvider {
  public lastQuery: any;

  constructor(private events: Events) { }

  public redir(redirTo, params) {
    if (this.checkLastQuery(params)) {
      return;
    } else {
      this.setLastQuery(params);
      this.events.publish('redirToEvent', { redirTo, params });
    }
  }

  public checkLastQuery(newQuery) {
    return newQuery === this.lastQuery;
  }

  private setLastQuery(newQuery) {
    this.lastQuery = newQuery;
  }
}
