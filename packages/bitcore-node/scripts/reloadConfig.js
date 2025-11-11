import { Config } from '../build/src/services/config.js';

const oldConfig = Config.get();
Config.reload();
const newConfig = Config.get();

function getChangedProps(obj1, obj2, path = '') {
  let changes = [];
  for (const key of new Set([...Object.keys(obj1), ...Object.keys(obj2)])) {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof obj1[key] === 'object' && obj1[key] !== null &&
        typeof obj2[key] === 'object' && obj2[key] !== null &&
        !Array.isArray(obj1[key]) && !Array.isArray(obj2[key])) {
      changes = changes.concat(getChangedProps(obj1[key], obj2[key], fullPath));
    } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
      changes.push(fullPath);
      console.log(`${key}: ${obj1[key]} -> ${obj2[key]}`);
    }
  }
  return changes;
}

getChangedProps(oldConfig, newConfig);
