import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseToAST, stringify, JSONSyntaxError } from '../src/index.js';

describe('craft-json parser (JavaScript / JSX)', () => {
  describe('Primitives', () => {
    test('parses null', () => {
      assert.equal(parse('null'), null);
    });

    test('parses booleans', () => {
      assert.equal(parse('true'), true);
      assert.equal(parse('false'), false);
    });

    test('parses numbers', () => {
      assert.equal(parse('0'), 0);
      assert.equal(parse('-0'), -0);
      assert.equal(parse('42'), 42);
      assert.equal(parse('-100'), -100);
      assert.equal(parse('3.14159'), 3.14159);
      assert.equal(parse('-0.5'), -0.5);
      assert.equal(parse('1e5'), 100000);
      assert.equal(parse('2.5E-3'), 0.0025);
      assert.equal(parse('1.2e+4'), 12000);
    });

    test('parses strings', () => {
      assert.equal(parse('""'), '');
      assert.equal(parse('"hello world"'), 'hello world');
      assert.equal(parse('"hello \\"world\\""'), 'hello "world"');
      assert.equal(parse('"line1\\nline2"'), 'line1\nline2');
      assert.equal(parse('"tab\\ttab"'), 'tab\ttab');
      assert.equal(parse('"slash\\/backslash\\\\"'), 'slash/backslash\\');
      assert.equal(parse('"unicode \\u0041\\u0042"'), 'unicode AB');
      assert.equal(parse('"emoji \\uD83D\\uDE00"'), 'emoji 😀');
    });
  });

  describe('Objects and Arrays', () => {
    test('parses empty objects and arrays', () => {
      assert.deepEqual(parse('{}'), {});
      assert.deepEqual(parse('[]'), []);
    });

    test('parses simple arrays', () => {
      assert.deepEqual(parse('[1, 2, 3]'), [1, 2, 3]);
      assert.deepEqual(parse('["a", "b", "c"]'), ['a', 'b', 'c']);
      assert.deepEqual(parse('[true, false, null]'), [true, false, null]);
    });

    test('parses nested objects and arrays', () => {
      const input = `
      {
        "name": "craft-json",
        "tags": ["parser", "jsx", "ast"],
        "meta": {
          "version": 1,
          "active": true
        }
      }
      `;
      assert.deepEqual(parse(input), {
        name: 'craft-json',
        tags: ['parser', 'jsx', 'ast'],
        meta: {
          version: 1,
          active: true,
        },
      });
    });
  });

  describe('Reviver function', () => {
    test('transforms values with reviver', () => {
      const json = '{"date": "2026-11-22T00:00:00.000Z", "count": "42"}';
      const result = parse(json, (key, value) => {
        if (key === 'date') return new Date(value);
        if (key === 'count') return Number(value);
        return value;
      });

      assert.equal(result.date instanceof Date, true);
      assert.equal(result.count, 42);
    });

    test('deletes properties if reviver returns undefined', () => {
      const json = '{"keep": 1, "drop": 2}';
      const result = parse(json, (key, value) => {
        if (key === 'drop') return undefined;
        return value;
      });

      assert.deepEqual(result, { keep: 1 });
    });
  });

  describe('Syntax Errors and Diagnostics', () => {
    test('throws JSONSyntaxError with line and column', () => {
      try {
        parse('{\n  "name": "craft-json",\n  "broken": ,\n}');
        assert.fail('Should have thrown JSONSyntaxError');
      } catch (err) {
        assert.equal(err instanceof JSONSyntaxError, true);
        assert.equal(err.line, 3);
        assert.equal(err.column, 13);
        assert.match(err.snippet, /\^/);
      }
    });

    test('rejects leading zeros in strict mode', () => {
      assert.throws(() => parse('012'), JSONSyntaxError);
      assert.throws(() => parse('-01'), JSONSyntaxError);
    });

    test('rejects leading plus in strict mode', () => {
      assert.throws(() => parse('+42'), JSONSyntaxError);
    });

    test('rejects unescaped control characters in strings', () => {
      assert.throws(() => parse('"\x00"'), JSONSyntaxError);
      assert.throws(() => parse('"\n"'), JSONSyntaxError);
    });

    test('rejects trailing commas in strict mode', () => {
      assert.throws(() => parse('[1, 2,]'), JSONSyntaxError);
      assert.throws(() => parse('{"a": 1,}'), JSONSyntaxError);
    });

    test('rejects comments in strict mode', () => {
      assert.throws(() => parse('// comment\n{"a": 1}'), JSONSyntaxError);
      assert.throws(() => parse('/* comment */ {"a": 1}'), JSONSyntaxError);
    });

    test('rejects trailing content after top-level JSON value', () => {
      assert.throws(() => parse('{"a": 1} trailing'), JSONSyntaxError);
    });
  });

  describe('Relaxed Mode Extensions', () => {
    test('parses single-line and multi-line comments when allowComments is true', () => {
      const input = `
        // Configuration settings
        {
          /* App name */
          "name": "craft-json",
          "port": 8080 // default port
        }
      `;
      const res = parse(input, { allowComments: true });
      assert.deepEqual(res, { name: 'craft-json', port: 8080 });
    });

    test('parses trailing commas when allowTrailingCommas is true', () => {
      const res = parse('{"a": 1, "b": [10, 20,],}', { allowTrailingCommas: true });
      assert.deepEqual(res, { a: 1, b: [10, 20] });
    });

    test('parses single-quoted strings when allowSingleQuotes is true', () => {
      const res = parse("{'hello': 'world\\'s'}", { allowSingleQuotes: true });
      assert.deepEqual(res, { hello: "world's" });
    });

    test('parses unquoted identifier keys when allowUnquotedKeys is true', () => {
      const res = parse('{ foo: "bar", _count: 42, $price: 9.99 }', { allowUnquotedKeys: true });
      assert.deepEqual(res, { foo: 'bar', _count: 42, $price: 9.99 });
    });

    test('parses numeric extensions (hex, Infinity, NaN) when allowNumericExtensions is true', () => {
      const res = parse('[0xFF, +10, Infinity, NaN]', { allowNumericExtensions: true });
      assert.equal(res[0], 255);
      assert.equal(res[1], 10);
      assert.equal(res[2], Infinity);
      assert.equal(isNaN(res[3]), true);
    });
  });

  describe('Abstract Syntax Tree (parseToAST)', () => {
    test('generates AST with source locations', () => {
      const ast = parseToAST('{"key": 42}');
      assert.equal(ast.type, 'Object');
      assert.equal(ast.properties.length, 1);
      assert.equal(ast.properties[0].key.value, 'key');
      assert.equal(ast.properties[0].value.type, 'Number');
      assert.equal(ast.properties[0].value.value, 42);
      assert.equal(ast.loc.start.line, 1);
      assert.equal(ast.loc.start.column, 1);
    });
  });

  describe('stringify', () => {
    test('stringifies primitives, arrays, and objects', () => {
      assert.equal(stringify(null), 'null');
      assert.equal(stringify(true), 'true');
      assert.equal(stringify(42), '42');
      assert.equal(stringify('hello'), '"hello"');
      assert.equal(stringify([1, 'a', false]), '[1,"a",false]');
      assert.equal(stringify({ a: 1 }), '{"a":1}');
    });

    test('formats with space indentation', () => {
      const res = stringify({ a: [1, 2] }, null, 2);
      assert.equal(res, '{\n  "a": [\n    1,\n    2\n  ]\n}');
    });

    test('throws TypeError on circular structures', () => {
      const circular = {};
      circular.self = circular;
      assert.throws(() => stringify(circular), TypeError);
    });

    test('handles toJSON method', () => {
      const date = new Date('2026-11-22T00:00:00.000Z');
      assert.equal(stringify({ d: date }), `{"d":"${date.toISOString()}"}`);
    });
  });
});
