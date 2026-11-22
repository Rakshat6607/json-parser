import { JSONSyntaxError } from './error.js';
import { PositionTracker } from './position.js';

export class Lexer {
  constructor(source, options = {}) {
    this.source = source;
    this.options = options;
    this.tracker = new PositionTracker(source);
    this.length = source.length;
    this.pos = 0;
  }

  error(message, offset = this.pos) {
    throw new JSONSyntaxError(message, this.source, offset);
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.length) {
      const ch = this.source[this.pos];

      // RFC 8259 whitespace: Space, Horizontal Tab, Line Feed, Carriage Return
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos++;
        continue;
      }

      // Check comments if enabled
      if (this.options.allowComments && ch === '/') {
        const next = this.pos + 1 < this.length ? this.source[this.pos + 1] : '';
        if (next === '/') {
          // Single-line comment: // until \n or EOF
          this.pos += 2;
          while (this.pos < this.length && this.source[this.pos] !== '\n') {
            this.pos++;
          }
          continue;
        } else if (next === '*') {
          // Multi-line comment: /* until */
          const commentStart = this.pos;
          this.pos += 2;
          let closed = false;
          while (this.pos + 1 < this.length) {
            if (this.source[this.pos] === '*' && this.source[this.pos + 1] === '/') {
              this.pos += 2;
              closed = true;
              break;
            }
            this.pos++;
          }
          if (!closed) {
            this.error('Unterminated multi-line comment', commentStart);
          }
          continue;
        }
      }

      break;
    }
  }

  nextToken(expectKey = false) {
    this.skipWhitespaceAndComments();

    const startOffset = this.pos;
    const startPos = this.tracker.getPosition(startOffset);

    if (this.pos >= this.length) {
      return {
        type: 'EOF',
        value: null,
        start: startPos,
        end: startPos,
        raw: '',
      };
    }

    const ch = this.source[this.pos];

    switch (ch) {
      case '{':
        this.pos++;
        return {
          type: 'LEFT_BRACE',
          value: '{',
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: '{',
        };
      case '}':
        this.pos++;
        return {
          type: 'RIGHT_BRACE',
          value: '}',
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: '}',
        };
      case '[':
        this.pos++;
        return {
          type: 'LEFT_BRACKET',
          value: '[',
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: '[',
        };
      case ']':
        this.pos++;
        return {
          type: 'RIGHT_BRACKET',
          value: ']',
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: ']',
        };
      case ':':
        this.pos++;
        return {
          type: 'COLON',
          value: ':',
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: ':',
        };
      case ',':
        this.pos++;
        return {
          type: 'COMMA',
          value: ',',
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: ',',
        };
      case '"':
        return this.scanString('"');
      case "'":
        if (this.options.allowSingleQuotes) {
          return this.scanString("'");
        }
        this.error(`Unexpected token '${ch}'. In strict JSON, strings must use double quotes (")`, startOffset);
    }

    // Numbers or numeric extensions
    if (ch === '-' || (ch >= '0' && ch <= '9') || (this.options.allowNumericExtensions && (ch === '+' || ch === '.'))) {
      return this.scanNumber();
    }

    // Literals or identifiers
    if (this.isIdentifierStart(ch)) {
      return this.scanIdentifierOrLiteral(expectKey);
    }

    this.error(`Unexpected character '${ch}'`, startOffset);
  }

  scanString(quoteChar) {
    const startOffset = this.pos;
    const startPos = this.tracker.getPosition(startOffset);
    this.pos++; // consume opening quote

    let result = '';

    while (this.pos < this.length) {
      const ch = this.source[this.pos];

      if (ch === quoteChar) {
        this.pos++; // consume closing quote
        const endPos = this.tracker.getPosition(this.pos);
        const raw = this.source.slice(startOffset, this.pos);
        return {
          type: 'STRING',
          value: result,
          start: startPos,
          end: endPos,
          raw,
        };
      }

      if (ch === '\\') {
        this.pos++; // consume backslash
        if (this.pos >= this.length) {
          this.error('Unexpected end of input inside string escape sequence', this.pos);
        }
        const escapeChar = this.source[this.pos];
        this.pos++;

        switch (escapeChar) {
          case '"':
            result += '"';
            break;
          case '\\':
            result += '\\';
            break;
          case '/':
            result += '/';
            break;
          case 'b':
            result += '\b';
            break;
          case 'f':
            result += '\f';
            break;
          case 'n':
            result += '\n';
            break;
          case 'r':
            result += '\r';
            break;
          case 't':
            result += '\t';
            break;
          case "'":
            if (this.options.allowSingleQuotes && quoteChar === "'") {
              result += "'";
              break;
            }
            this.error("Invalid escape sequence '\\'' in double-quoted JSON string", this.pos - 2);
          case 'u': {
            const hexOffset = this.pos;
            if (this.pos + 4 > this.length) {
              this.error('Incomplete Unicode escape sequence \\uXXXX', hexOffset - 2);
            }
            const hex = this.source.slice(this.pos, this.pos + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              this.error(`Invalid Unicode escape sequence \\u${hex}`, hexOffset - 2);
            }
            this.pos += 4;
            const codePoint = parseInt(hex, 16);
            result += String.fromCharCode(codePoint);
            break;
          }
          default:
            this.error(`Invalid escape sequence '\\${escapeChar}' in string`, this.pos - 2);
        }
        continue;
      }

      // Check for unescaped control characters (ASCII 0x00 to 0x1F)
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === '\n' || ch === '\r') {
          this.error('Unterminated string literal before end of line', startOffset);
        }
        this.error(`Unescaped control character 0x${code.toString(16).padStart(2, '0')} in string`, this.pos);
      }

      result += ch;
      this.pos++;
    }

    this.error('Unterminated string literal at end of input', startOffset);
  }

  scanNumber() {
    const startOffset = this.pos;
    const startPos = this.tracker.getPosition(startOffset);

    // Relaxed numeric extensions: Infinity, -Infinity, NaN, 0x...
    if (this.options.allowNumericExtensions) {
      if (this.source.slice(this.pos, this.pos + 8) === 'Infinity') {
        this.pos += 8;
        return {
          type: 'NUMBER',
          value: Infinity,
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: 'Infinity',
        };
      }
      if (this.source.slice(this.pos, this.pos + 9) === '-Infinity') {
        this.pos += 9;
        return {
          type: 'NUMBER',
          value: -Infinity,
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: '-Infinity',
        };
      }
      if (this.source.slice(this.pos, this.pos + 3) === 'NaN') {
        this.pos += 3;
        return {
          type: 'NUMBER',
          value: NaN,
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: 'NaN',
        };
      }
      // Hexadecimal: 0x...
      if (
        (this.source[this.pos] === '0' && (this.source[this.pos + 1] === 'x' || this.source[this.pos + 1] === 'X')) ||
        (this.source[this.pos] === '-' &&
          this.source[this.pos + 1] === '0' &&
          (this.source[this.pos + 2] === 'x' || this.source[this.pos + 2] === 'X'))
      ) {
        let isNeg = false;
        if (this.source[this.pos] === '-') {
          isNeg = true;
          this.pos++;
        }
        this.pos += 2;
        const hexStart = this.pos;
        while (this.pos < this.length && /[0-9a-fA-F]/.test(this.source[this.pos])) {
          this.pos++;
        }
        if (this.pos === hexStart) {
          this.error('Expected hexadecimal digits after 0x', startOffset);
        }
        const rawHex = this.source.slice(startOffset, this.pos);
        const hexVal = parseInt(this.source.slice(hexStart, this.pos), 16) * (isNeg ? -1 : 1);
        return {
          type: 'NUMBER',
          value: hexVal,
          start: startPos,
          end: this.tracker.getPosition(this.pos),
          raw: rawHex,
        };
      }
    }

    // Optional sign
    if (this.source[this.pos] === '-') {
      this.pos++;
    } else if (this.options.allowNumericExtensions && this.source[this.pos] === '+') {
      this.pos++;
    }

    if (this.pos >= this.length) {
      this.error('Expected digits after minus sign', startOffset);
    }

    // Integer part
    const intStart = this.pos;
    if (this.source[this.pos] === '0') {
      this.pos++;
      if (this.pos < this.length && this.isDigit(this.source[this.pos])) {
        this.error('Leading zeros are not permitted in JSON numbers', intStart);
      }
    } else if (this.isDigit(this.source[this.pos])) {
      while (this.pos < this.length && this.isDigit(this.source[this.pos])) {
        this.pos++;
      }
    } else if (this.options.allowNumericExtensions && this.source[this.pos] === '.') {
      // Allowed leading decimal point in relaxed mode
    } else {
      this.error(`Unexpected character '${this.source[this.pos]}' in number`, this.pos);
    }

    // Fractional part
    if (this.pos < this.length && this.source[this.pos] === '.') {
      this.pos++;
      const fracStart = this.pos;
      while (this.pos < this.length && this.isDigit(this.source[this.pos])) {
        this.pos++;
      }
      if (this.pos === fracStart && !this.options.allowNumericExtensions) {
        this.error('Decimal point must be followed by at least one digit', this.pos);
      }
    }

    // Exponent part
    if (this.pos < this.length && (this.source[this.pos] === 'e' || this.source[this.pos] === 'E')) {
      this.pos++;
      if (this.pos < this.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
        this.pos++;
      }
      const expStart = this.pos;
      while (this.pos < this.length && this.isDigit(this.source[this.pos])) {
        this.pos++;
      }
      if (this.pos === expStart) {
        this.error('Exponent must be followed by at least one digit', this.pos);
      }
    }

    const raw = this.source.slice(startOffset, this.pos);
    const num = Number(raw);

    if (isNaN(num) && !this.options.allowNumericExtensions) {
      this.error(`Invalid number '${raw}'`, startOffset);
    }

    return {
      type: 'NUMBER',
      value: num,
      start: startPos,
      end: this.tracker.getPosition(this.pos),
      raw,
    };
  }

  scanIdentifierOrLiteral(expectKey) {
    const startOffset = this.pos;
    const startPos = this.tracker.getPosition(startOffset);

    while (this.pos < this.length && this.isIdentifierPart(this.source[this.pos])) {
      this.pos++;
    }

    const word = this.source.slice(startOffset, this.pos);
    const endPos = this.tracker.getPosition(this.pos);

    if (word === 'true') {
      return { type: 'TRUE', value: true, start: startPos, end: endPos, raw: word };
    }
    if (word === 'false') {
      return { type: 'FALSE', value: false, start: startPos, end: endPos, raw: word };
    }
    if (word === 'null') {
      return { type: 'NULL', value: null, start: startPos, end: endPos, raw: word };
    }

    if (this.options.allowNumericExtensions) {
      if (word === 'Infinity') {
        return { type: 'NUMBER', value: Infinity, start: startPos, end: endPos, raw: word };
      }
      if (word === 'NaN') {
        return { type: 'NUMBER', value: NaN, start: startPos, end: endPos, raw: word };
      }
    }

    if (this.options.allowUnquotedKeys) {
      return {
        type: 'IDENTIFIER',
        value: word,
        start: startPos,
        end: endPos,
        raw: word,
      };
    }

    this.error(`Unexpected token '${word}'`, startOffset);
  }

  isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  isIdentifierStart(ch) {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_' ||
      ch === '$'
    );
  }

  isIdentifierPart(ch) {
    return this.isIdentifierStart(ch) || this.isDigit(ch);
  }
}
