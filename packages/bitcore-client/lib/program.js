const program = require('commander');

const _parse = program.parse.bind(program);

program.parse = (args) => {
  _parse(args);

  const requiredOptions = program.options.filter(opt => opt.required && opt.required !== 0);

  const options = requiredOptions.map(option => {
    return option.long.replace('--', '');
  });

  if (!!options.some(element => !Object.getOwnPropertyNames(program).includes(element))) {
    throw new Error(`Missing a required flag`);
  }

}

module.exports = program;
