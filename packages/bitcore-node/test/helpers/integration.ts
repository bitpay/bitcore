import { Config } from '../../build/src/services/config';
import { Modules } from '../../src/modules';
import { Storage } from '../../src/services/storage';
import { wait } from '../../src/utils';

const storageArgs = {
  dbHost: Config.get().dbHost,
  dbName: 'bitcore-integration'
};

let loaded = false;
export async function intBeforeHelper() {
  try {
    if (!loaded) {
      Modules.loadConfigured();
      loaded = true;
    }
    if (!Storage.connected) {
      await Storage.start(storageArgs);
      await wait(2000);
    }
  } catch (e) {
    console.error(e);
  }
}

export async function intAfterHelper(describeContext?: any) {
  try {
    if (describeContext && describeContext.timeout) {
      describeContext.timeout(1);
    }
  } catch (e) {
    console.error(e);
  }
}
