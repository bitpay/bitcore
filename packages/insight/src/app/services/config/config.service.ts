import { Injectable } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Chain } from '../../types/configuration';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  public currentNetwork = new BehaviorSubject<Chain>(
    environment.initialNetwork
  );
  public availableNetworks = new BehaviorSubject<Chain[]>(
    environment.expectedNetworks
  );
  public apiPrefix = new BehaviorSubject<string>(environment.apiPrefix);
  constructor(private logger: NGXLogger) {
    this.logger.debug(
      `ConfigService initialized in ${
        environment.production ? 'production' : 'non-production'
      } mode.`
    );
  }
}
