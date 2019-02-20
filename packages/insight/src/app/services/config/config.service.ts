import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AppPreferences } from '@ionic-native/app-preferences/ngx';
import { NGXLogger } from 'ngx-logger';
import { BehaviorSubject } from 'rxjs';
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
    private titleService: Title,
    private appPreferences: AppPreferences
  ) {
    this.logger.debug(
      `ConfigService initialized in ${
        environment.production ? 'production' : 'non-production'
      } mode.`
    );
  }

  setTitle(newTitle: string) {
    this.titleService.setTitle(newTitle);
  }
}
