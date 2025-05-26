import { BaseModule } from '..';
import { SOLStateProvider } from './api/csp';
import { SOLRoutes } from './api/sol-routes';

export default class SOLModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string) {
    super(services);
    services.CSP.registerService(chain, network, new SOLStateProvider());
    services.Api.app.use(SOLRoutes);
  }
}