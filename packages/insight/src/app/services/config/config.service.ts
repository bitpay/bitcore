import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppPreferences } from '@ionic-native/app-preferences/ngx';
import * as equal from 'fast-deep-equal';
import { NGXLogger } from 'ngx-logger';
import { BehaviorSubject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Chain } from '../../types/chains';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  currentChain$ = new BehaviorSubject<Chain>(environment.initialChain);
  availableChains$ = new BehaviorSubject<Chain[]>(environment.expectedChains);
  apiPrefix$ = new BehaviorSubject<string>(environment.apiPrefix);
  ratesApi$ = new BehaviorSubject<string>(environment.ratesApi);
  // TODO: save changes to AppPreferences, try to load from AppPreferences before using environment setting
  displayValueCode$ = new BehaviorSubject<string>(
    environment.initialDisplayValueCode
  );

  constructor(
    private logger: NGXLogger,
    private router: Router,
    private appPreferences: AppPreferences
  ) {
    this.logger.debug(
      `ConfigService initialized in ${
        environment.production ? 'production' : 'non-production'
      } mode.`
    );
  }
}
