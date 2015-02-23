import chalk from 'chalk';
import util from 'util';

const newLine = '\n';

/*!
 * Internal functions to color warnings and errors.
 */
export default {

  warn () {
    console.warn(chalk.yellow(...arguments));
  },

  info () {
    console.warn(chalk.green(...Array.from(arguments, arg =>
      typeof arg === 'object' ? util.inspect(arg, {
        depth: null
      }) : arg)));
  },

  debug () {
    console.warn(chalk.cyan(...Array.from(arguments, arg =>
      typeof arg === 'object' ? util.inspect(arg, {
        depth: null
      }) : arg)));
  },

  error () {
    // Assume that everything past the first line of an error
    // is a stack trace, and color it differently.
    console.error(...Array.from(arguments, arg =>
      arg.split(newLine).map((line, index) =>
        index > 0 ? chalk.dim(line) : chalk.red(line)
      ).join(newLine)));
  }

};
