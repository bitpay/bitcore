const program = require('commander');

const _parse = program.parse.bind(program);

program.parse = args => {
  _parse(args);

  const requiredOptions = program.options.filter(opt => opt.required && opt.required !== 0);

  const programProps = Object.getOwnPropertyNames(program);
  for (let option of program.options) {
    const optionName = option.long.replace('--', '');
    const required = option.required && option.required !== 0;
    const missing = !programProps.includes(optionName);
    if (required && missing) {
      throw new Error(`Missing required flag: --${optionName}`);
    }
  }
};

module.exports = program;
