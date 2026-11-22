import { parse, parseToAST } from './parser.js';
import { stringify } from './stringify.js';
import { JSONSyntaxError } from './error.js';
import { PositionTracker } from './position.js';
import { Lexer } from './lexer.js';
import { JsonParser } from './JsonParser.jsx';

export {
  parse,
  parseToAST,
  stringify,
  JSONSyntaxError,
  PositionTracker,
  Lexer,
  JsonParser,
};

export const craftJson = {
  parse,
  parseToAST,
  stringify,
  JSONSyntaxError,
  PositionTracker,
  Lexer,
  JsonParser,
};

export default craftJson;
