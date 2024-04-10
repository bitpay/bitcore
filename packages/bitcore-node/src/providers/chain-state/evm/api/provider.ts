import * as worker from 'worker_threads';
import { IChainConfig, IEVMNetworkConfig, IProvider } from '../../../../types/Config';

const getProvider = ({ 
  network,
  config,
  dataType 
}: { network: string, dataType: string | undefined, config: IChainConfig<IEVMNetworkConfig>}) => {
  let defaultProvider;
  if (config[network]?.provider && matchProviderType(config[network].provider, dataType)) {
    defaultProvider = config[network].provider;
  }
  const providers: any = config[network]?.providers?.filter((p) => matchProviderType(p, dataType));
  const providerIdx: number = worker.threadId % (providers || []).length;
  return defaultProvider || !isNaN(providerIdx) ? providers![providerIdx] : undefined;
}

const matchProviderType = (provider : IProvider | undefined, type : string | undefined): boolean => {
  if (!provider) {
    return false;
  }
  // dataType is not required for IProvider so we return true if dataType is undefined and provider is defined
  if (!type || !provider.dataType) {
    return true;
  }
  // ************  Type match chart  ************************
  // Type       | Array of matched provider.dataType's
  // --------------------------------------------------------
  // realtime   : [ realtime, combined ]
  // historical : [ historical, combined ]
  // combined   : [ combined ]
  // undefined  : [ historical, combined, realtime ]
  if (provider.dataType === 'combined' || type === provider.dataType) {
    return true;
  }    
  return false;
}

const isValidProviderType = (expectedType, type) => {
  const validTypes = expectedType ? ['combined', expectedType]  : ['combined'];
  return validTypes.includes(type);
}

export {
  getProvider,
  matchProviderType,
  isValidProviderType
};