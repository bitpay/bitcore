import { loadModules } from '../../src/modules';

let loaded = false;
export async function unitBeforeHelper() {
  if (!loaded) {
    console.time('Loading Modules');
    loadModules();
    loaded = true;
    console.timeEnd('Loading Modules');
  }
}

export async function unitAfterHelper() {}
