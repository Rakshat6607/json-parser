import { parse, parseToAST } from './parser.js';
import { stringify } from './stringify.js';
import { JSONSyntaxError } from './error.js';
import { PositionTracker } from './position.js';
import { Lexer } from './lexer.js';

export {
  parse,
  parseToAST,
  stringify,
  JSONSyntaxError,
  PositionTracker,
  Lexer,
};

export const craftJson = {
  parse,
  parseToAST,
  stringify,
  JSONSyntaxError,
  PositionTracker,
  Lexer,
};

export default craftJson;
