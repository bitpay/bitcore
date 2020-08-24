import { Modules } from '../../src/modules';

let loaded = false;
export async function unitBeforeHelper() {
  if (!loaded) {
    Modules.loadConfigured();
    loaded = true;
  }
}

export async function unitAfterHelper() {}
