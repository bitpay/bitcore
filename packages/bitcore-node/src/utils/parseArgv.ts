type Required = 'string' | 'int' | 'number' | 'float'
type Optional = Required | 'bool' | 'boolean';
type Arg<T> = string | { arg: string; type: T; }

/**
 * parseArgv
 * returns an object from argv
 * @param {Arg[]} required - array of required arguments
 * @param {Arg[]} optional=[] - array of optional arguments to capture
 * @returns {object}
 */
export default function parseArgv(required: Arg<Required>[], optional: Arg<Optional>[] = []): any {
  let parsed = {};
  for (let arg of required) {
    let type = 'string';
    if (typeof arg === 'object') {
      ({ arg, type } = arg);
    }
    const argIndex = process.argv.indexOf(`--${arg}`);
    if (argIndex === -1) throw new Error(arg + ' is a required command argument');
    const argValue = convertType(argIndex >= 0 ? process.argv[argIndex + 1] : '', type);
    if (argValue == null || argValue === '') throw new Error(arg + ' is missing a value of ' + type + ' type');
    Object.assign(parsed, { [arg as string]: argValue });
  }
  for (let arg of optional) {
    let type = 'string';
    if (typeof arg === 'object') {
      ({ arg, type } = arg);
    }
    const argIndex = process.argv.indexOf(`--${arg}`);
    const argValue = convertType(argIndex >= 0 ? process.argv[argIndex + 1] : '', type);
    if (argIndex > -1 && (argValue == null || argValue === '')) throw new Error(arg + ' is missing a value of ' + type + ' type');
    Object.assign(parsed, { [arg as string]: argValue });
  }
  return parsed;
}

function convertType(val, type) {
  switch (type) {
    case 'string':
    default:
      return val;
    case 'bool':
    case 'boolean':
      val = val === '' ? 'false' : val; // if index of param was -1, then val will be ''
      const givenWithoutVal = val == null || val?.startsWith('--');
      return Boolean(val === 'true' || parseInt(val) || givenWithoutVal);
    case 'int':
      if (!val) { return }
      if (isNaN(parseInt(val))) {
        throw new Error(`Invalid arg type. Expected int but got "${val}"`);
      }
      return parseInt(val);
    case 'number':
    case 'float':
      if (!val) { return }
      if (isNaN(parseFloat(val))) {
        throw new Error(`Invalid arg type. Expected float but got "${val}"`);
      }
      return parseFloat(val);
  }
}
