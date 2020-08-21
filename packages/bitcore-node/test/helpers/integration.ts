import config from '../../src/config';
import { Modules } from '../../src/modules';
import { Storage } from '../../src/services/storage';
import { wait } from '../../src/utils/wait';

const storageArgs = {
  dbHost: config.dbHost,
  dbName: 'bitcore-integration'
};

export async function intBeforeHelper() {
  try {
    await Storage.start(storageArgs);
    Modules.loadConfigured();
    await wait(2000);
  } catch (e) {
    console.error(e);
  }
}

export async function intAfterHelper(describeContext?: any) {
  try {
    await Storage.stop();
    describeContext = describeContext;
    if (describeContext && describeContext.timeout) {
      describeContext.timeout(1);
    }
  } catch (e) {
    console.error(e);
  }
}
