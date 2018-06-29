const program = require('commander');

const _parse = program.parse.bind(program);

program.parse = (args) => {
  _parse(args);

  const requiredOptions = program.options.filter(opt => opt.required && opt.required !== 0);

  const options = requiredOptions.map(option => {
    return option.long.replace('--', '');
  });

  const match = !options.some(element => !Object.getOwnPropertyNames(program).includes(element));

  if (!match) {
    const missing = options.filter(match => {
      return !Object.getOwnPropertyNames(program).includes(match);
    })
    throw new Error(`Missing required flag: --${missing}`);
  }
}

module.exports = program;
