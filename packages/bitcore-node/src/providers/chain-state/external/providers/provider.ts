import * as worker from 'worker_threads';
import { IChainConfig, IEVMNetworkConfig, IProvider } from '../../../../types/Config';

const getProvider = (params: {
  network: string,
  dataType: string | undefined,
  config: IChainConfig<IEVMNetworkConfig>
}): IProvider => {
  const { network, config, dataType } = params;
  if (config[network]?.provider && matchProviderType(config[network].provider, dataType)) {
    return config[network].provider!;
  }
  const providers = config[network]?.providers?.filter((p) => !p.disabled && matchProviderType(p, dataType));
  if (!providers?.length) {
    throw new Error(`No configuration found for ${network} and "${dataType}" compatible dataType`);
  }
  const providerIdx = worker.threadId % providers.length;
  return providers[providerIdx];
}

const hasProvider = ({ network, config, dataType }): boolean => {
  try {
    getProvider({ network, config, dataType });
    return true;
  } catch {
    return false;
  }
};

const matchProviderType = (provider?: IProvider, type?: string): boolean => {
  if (!provider) {
    return false;
  }
  
  if (!type || !provider.dataType || provider.dataType === 'combined') {
    return true;
  }
  // ************  Type match chart  ************************
  // Type       | Array of matched provider.dataType's
  // --------------------------------------------------------
  // realtime   : [ realtime, combined ]
  // historical : [ historical, combined ]
  // combined   : [ combined ]
  // undefined  : [ historical, combined, realtime ]
  if (type === provider.dataType) {
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
  hasProvider,
  matchProviderType,
  isValidProviderType
};