import { Injectable } from '@angular/core';
import { Events } from 'ionic-angular';

@Injectable()
export class RedirProvider {
  constructor(private events: Events) {}

  public redir(redirTo, params) {
    this.events.publish('redirToEvent', { redirTo, params });
  }
}
