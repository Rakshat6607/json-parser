import { JSONSyntaxError } from './error.js';
import { Lexer } from './lexer.js';
import {
  createASTArray,
  createASTBoolean,
  createASTNull,
  createASTNumber,
  createASTObject,
  createASTProperty,
  createASTString,
} from './ast.js';

export class Parser {
  constructor(source, options = {}) {
    this.source = source;
    this.options = options;
    this.maxDepth = options.maxDepth ?? 512;
    this.depth = 0;
    this.lexer = new Lexer(source, options);
    this.advance();
  }

  advance(expectKey = false) {
    const prev = this.currentToken;
    this.currentToken = this.lexer.nextToken(expectKey);
    return prev;
  }

  error(message, token = this.currentToken) {
    throw new JSONSyntaxError(message, this.source, token.start.offset);
  }

  expect(type, message) {
    if (this.currentToken.type !== type) {
      this.error(message ?? `Expected '${type}' but found '${this.currentToken.type}'`);
    }
    return this.advance();
  }

  parseValue() {
    if (this.depth > this.maxDepth) {
      this.error(`Maximum parsing depth of ${this.maxDepth} exceeded`);
    }

    const token = this.currentToken;

    switch (token.type) {
      case 'STRING':
        this.advance();
        return token.value;

      case 'NUMBER':
        this.advance();
        return token.value;

      case 'TRUE':
        this.advance();
        return true;

      case 'FALSE':
        this.advance();
        return false;

      case 'NULL':
        this.advance();
        return null;

      case 'LEFT_BRACE':
        return this.parseObject();

      case 'LEFT_BRACKET':
        return this.parseArray();

      case 'IDENTIFIER':
        this.error(`Unexpected identifier '${token.raw}'`);

      case 'EOF':
        this.error('Unexpected end of JSON input');

      default:
        this.error(`Unexpected token '${token.raw}'`);
    }
  }

  parseObject() {
    this.depth++;
    const obj = {};
    const seenKeys = this.options.disallowDuplicateKeys ? new Set() : null;

    this.advance(); // consume '{'

    // Empty object
    if (this.currentToken.type === 'RIGHT_BRACE') {
      this.advance();
      this.depth--;
      return obj;
    }

    while (true) {
      let key;
      const keyToken = this.currentToken;

      if (keyToken.type === 'STRING') {
        key = keyToken.value;
        this.advance();
      } else if (this.options.allowUnquotedKeys && keyToken.type === 'IDENTIFIER') {
        key = keyToken.value;
        this.advance();
      } else {
        this.error(
          `Expected string key in object but found '${keyToken.raw || keyToken.type}'`
        );
      }

      if (seenKeys) {
        if (seenKeys.has(key)) {
          this.error(`Duplicate object key '${key}'`, keyToken);
        }
        seenKeys.add(key);
      }

      this.expect('COLON', `Expected ':' after property name in object`);

      const value = this.parseValue();
      obj[key] = value;

      if (this.currentToken.type === 'COMMA') {
        this.advance();
        if (this.currentToken.type === 'RIGHT_BRACE') {
          if (!this.options.allowTrailingCommas) {
            this.error('Trailing commas are not permitted in strict JSON');
          }
          this.advance();
          break;
        }
      } else if (this.currentToken.type === 'RIGHT_BRACE') {
        this.advance();
        break;
      } else {
        this.error(`Expected ',' or '}' in object, found '${this.currentToken.raw}'`);
      }
    }

    this.depth--;
    return obj;
  }

  parseArray() {
    this.depth++;
    const arr = [];

    this.advance(); // consume '['

    // Empty array
    if (this.currentToken.type === 'RIGHT_BRACKET') {
      this.advance();
      this.depth--;
      return arr;
    }

    while (true) {
      arr.push(this.parseValue());

      if (this.currentToken.type === 'COMMA') {
        this.advance();
        if (this.currentToken.type === 'RIGHT_BRACKET') {
          if (!this.options.allowTrailingCommas) {
            this.error('Trailing commas are not permitted in strict JSON');
          }
          this.advance();
          break;
        }
      } else if (this.currentToken.type === 'RIGHT_BRACKET') {
        this.advance();
        break;
      } else {
        this.error(`Expected ',' or ']' in array, found '${this.currentToken.raw}'`);
      }
    }

    this.depth--;
    return arr;
  }

  parseRoot() {
    if (this.currentToken.type === 'EOF') {
      this.error('Unexpected end of JSON input');
    }

    const value = this.parseValue();

    if (this.currentToken.type !== 'EOF') {
      this.error(
        `Unexpected token '${this.currentToken.raw}' after top-level JSON value`
      );
    }

    return value;
  }

  // ---------------- AST Parsing ---------------- //

  parseASTValue() {
    if (this.depth > this.maxDepth) {
      this.error(`Maximum parsing depth of ${this.maxDepth} exceeded`);
    }

    const token = this.currentToken;

    switch (token.type) {
      case 'STRING': {
        this.advance();
        const loc = { start: token.start, end: token.end };
        return createASTString(token.value, loc, token.raw);
      }

      case 'NUMBER': {
        this.advance();
        const loc = { start: token.start, end: token.end };
        return createASTNumber(token.value, loc, token.raw);
      }

      case 'TRUE': {
        this.advance();
        const loc = { start: token.start, end: token.end };
        return createASTBoolean(true, loc, token.raw);
      }

      case 'FALSE': {
        this.advance();
        const loc = { start: token.start, end: token.end };
        return createASTBoolean(false, loc, token.raw);
      }

      case 'NULL': {
        this.advance();
        const loc = { start: token.start, end: token.end };
        return createASTNull(loc, token.raw);
      }

      case 'LEFT_BRACE':
        return this.parseASTObject();

      case 'LEFT_BRACKET':
        return this.parseASTArray();

      case 'IDENTIFIER':
        this.error(`Unexpected identifier '${token.raw}'`);

      case 'EOF':
        this.error('Unexpected end of JSON input');

      default:
        this.error(`Unexpected token '${token.raw}'`);
    }
  }

  parseASTObject() {
    this.depth++;
    const startToken = this.currentToken;
    this.advance(); // consume '{'

    const properties = [];
    const seenKeys = this.options.disallowDuplicateKeys ? new Set() : null;

    if (this.currentToken.type === 'RIGHT_BRACE') {
      const endToken = this.currentToken;
      this.advance();
      this.depth--;
      const loc = { start: startToken.start, end: endToken.end };
      const raw = this.source.slice(startToken.start.offset, endToken.end.offset);
      return createASTObject(properties, loc, raw);
    }

    while (true) {
      const keyToken = this.currentToken;
      let keyNode;

      if (keyToken.type === 'STRING') {
        keyNode = createASTString(
          keyToken.value,
          { start: keyToken.start, end: keyToken.end },
          keyToken.raw
        );
        this.advance();
      } else if (this.options.allowUnquotedKeys && keyToken.type === 'IDENTIFIER') {
        keyNode = createASTString(
          keyToken.value,
          { start: keyToken.start, end: keyToken.end },
          keyToken.raw
        );
        this.advance();
      } else {
        this.error(
          `Expected string key in object but found '${keyToken.raw || keyToken.type}'`
        );
      }

      if (seenKeys) {
        if (seenKeys.has(keyNode.value)) {
          this.error(`Duplicate object key '${keyNode.value}'`, keyToken);
        }
        seenKeys.add(keyNode.value);
      }

      this.expect('COLON', `Expected ':' after property name in object`);

      const valueNode = this.parseASTValue();
      const propLoc = { start: keyToken.start, end: valueNode.loc.end };
      const propRaw = this.source.slice(keyToken.start.offset, valueNode.loc.end.offset);
      properties.push(createASTProperty(keyNode, valueNode, propLoc, propRaw));

      if (this.currentToken.type === 'COMMA') {
        this.advance();
        if (this.currentToken.type === 'RIGHT_BRACE') {
          if (!this.options.allowTrailingCommas) {
            this.error('Trailing commas are not permitted in strict JSON');
          }
          break;
        }
      } else if (this.currentToken.type === 'RIGHT_BRACE') {
        break;
      } else {
        this.error(`Expected ',' or '}' in object, found '${this.currentToken.raw}'`);
      }
    }

    const endToken = this.expect('RIGHT_BRACE');
    this.depth--;
    const loc = { start: startToken.start, end: endToken.end };
    const raw = this.source.slice(startToken.start.offset, endToken.end.offset);
    return createASTObject(properties, loc, raw);
  }

  parseASTArray() {
    this.depth++;
    const startToken = this.currentToken;
    this.advance(); // consume '['

    const elements = [];

    if (this.currentToken.type === 'RIGHT_BRACKET') {
      const endToken = this.currentToken;
      this.advance();
      this.depth--;
      const loc = { start: startToken.start, end: endToken.end };
      const raw = this.source.slice(startToken.start.offset, endToken.end.offset);
      return createASTArray(elements, loc, raw);
    }

    while (true) {
      elements.push(this.parseASTValue());

      if (this.currentToken.type === 'COMMA') {
        this.advance();
        if (this.currentToken.type === 'RIGHT_BRACKET') {
          if (!this.options.allowTrailingCommas) {
            this.error('Trailing commas are not permitted in strict JSON');
          }
          break;
        }
      } else if (this.currentToken.type === 'RIGHT_BRACKET') {
        break;
      } else {
        this.error(`Expected ',' or ']' in array, found '${this.currentToken.raw}'`);
      }
    }

    const endToken = this.expect('RIGHT_BRACKET');
    this.depth--;
    const loc = { start: startToken.start, end: endToken.end };
    const raw = this.source.slice(startToken.start.offset, endToken.end.offset);
    return createASTArray(elements, loc, raw);
  }

  parseASTRoot() {
    if (this.currentToken.type === 'EOF') {
      this.error('Unexpected end of JSON input');
    }

    const ast = this.parseASTValue();

    if (this.currentToken.type !== 'EOF') {
      this.error(
        `Unexpected token '${this.currentToken.raw}' after top-level JSON value`
      );
    }

    return ast;
  }
}

/**
 * Standard ECMAScript reviver transformation.
 */
function internalize(holder, name, reviver) {
  const val = holder[name];
  if (val !== null && typeof val === 'object') {
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const item = internalize(val, String(i), reviver);
        if (item === undefined) {
          delete val[i];
        } else {
          val[i] = item;
        }
      }
    } else {
      for (const key of Object.keys(val)) {
        const item = internalize(val, key, reviver);
        if (item === undefined) {
          delete val[key];
        } else {
          val[key] = item;
        }
      }
    }
  }
  return reviver.call(holder, name, val);
}

/**
 * Parses a JSON string into a JavaScript value.
 * @param {string} text
 * @param {object|Function} [optionsOrReviver]
 * @returns {any}
 */
export function parse(text, optionsOrReviver) {
  if (typeof text !== 'string') {
    text = String(text);
  }

  let options = {};
  let reviver;

  if (typeof optionsOrReviver === 'function') {
    reviver = optionsOrReviver;
  } else if (optionsOrReviver && typeof optionsOrReviver === 'object') {
    options = optionsOrReviver;
    reviver = options.reviver;
  }

  const parser = new Parser(text, options);
  const root = parser.parseRoot();

  if (reviver) {
    const rootHolder = { '': root };
    return internalize(rootHolder, '', reviver);
  }

  return root;
}

/**
 * Parses a JSON string into an AST with exact source locations.
 * @param {string} text
 * @param {object} [options]
 * @returns {object}
 */
export function parseToAST(text, options = {}) {
  if (typeof text !== 'string') {
    text = String(text);
  }

  const parser = new Parser(text, options);
  return parser.parseASTRoot();
}
