import { EventEmitter } from 'events';
import { BaseModule } from '..';
import { IXrpNetworkConfig } from '../../types/Config';
import { RippleStateProvider } from './api/csp';
import { RippleEventAdapter } from './api/event-adapter';
import { XrpRoutes } from './api/xrp-routes';
import { XrpP2pWorker } from './p2p';
import { XrpVerificationPeer } from './p2p/verification';

export default class XRPModule extends BaseModule {
  static startMonitor: EventEmitter;
  static endMonitor: EventEmitter;
  constructor(services: BaseModule['bitcoreServices'], chain: string, network: string, _config: IXrpNetworkConfig) {
    super(services);
    services.CSP.registerService(chain, network, new RippleStateProvider());
    services.Api.app.use(XrpRoutes);
    services.P2P.register(chain, network, XrpP2pWorker);
    services.Verification.register(chain, network, XrpVerificationPeer);

    if (!XRPModule.startMonitor) {
      const adapter = new RippleEventAdapter(services, network);
      XRPModule.startMonitor = services.Event.events.on('start', async () => {
        await adapter.start();
      });
      XRPModule.endMonitor = services.Event.events.on('stop', async () => {
        await adapter.stop();
      });
    }
  }
}
