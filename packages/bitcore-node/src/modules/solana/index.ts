import { ChainStateProvider } from '../../providers/chain-state';
import { Api } from '../../services/api';
import { RegisterModule } from '../../types/Module';
import { SOLStateProvider } from './api/csp';
import { SOLRoutes } from './api/sol-routes';


const registerModule: RegisterModule = ({ chain, network }) => {
  ChainStateProvider.registerService(chain, network, new SOLStateProvider());
  Api.app.use(SOLRoutes);
};

export default registerModule;