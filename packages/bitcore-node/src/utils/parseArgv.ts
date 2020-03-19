/**
 * parseArgv
 * returns an object from argv
 * @param {String[]} required - array of required arguments
 * @param {String[]} optional=[] - array of optional arguments to capture
 * @returns {object}
 */
export default function parseArgv(required: string[], optional: string[] = []): any {
  let parsed = {};
  for (let arg of required) {
    const argIndex = process.argv.indexOf(`--${arg}`);
    let argValue = argIndex >= 0 ? process.argv[argIndex + 1] : '';
    if (!argValue) throw new Error(arg + ' is a required command argument');
    Object.assign(parsed, { [arg]: argValue });
  }
  for (let arg of optional) {
    const argIndex = process.argv.indexOf(`--${arg}`);
    let argValue = argIndex >= 0 ? process.argv[argIndex + 1] : '';
    Object.assign(parsed, { [arg]: argValue });
  }
  return parsed;
}
