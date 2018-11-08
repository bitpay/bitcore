import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlMatcher
} from '@angular/router';
import { environment } from '../../environments/environment';
import { ConfigService } from '../services/config/config.service';
import { Chain } from '../types/chains';

@Injectable({
  providedIn: 'root'
})
export class AvailableChainGuard implements CanActivateChild {
  constructor(private config: ConfigService, private router: Router) {}
  canActivateChild(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    /**
     * Because availableChainsMatcher only matches `code`s which are present in
     * `environment.expectedChains`, we can assume this is one.
     */
    const code = next.params.code;
    this.config.currentChain$.next(environment.expectedChains.find(
      chain => chain.code === code
    ) as Chain);
    return true;
  }
}

export const availableChainsMatcher = (segments => {
  if (segments.length < 1) {
    return null;
  }
  const chain = environment.expectedChains.find(
    c => c.code === segments[0].path
  );
  return chain !== undefined
    ? { consumed: [segments[0]], posParams: { code: segments[0] } }
    : null;
}) as UrlMatcher;
