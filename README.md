# craft-json

> Zero-dependency, RFC 8259 compliant JSON parser, serializer, and interactive React JSX component with pinpoint error diagnostics, AST generation, and configurable relaxed modes. Built entirely in JavaScript & JSX.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-26%20passed-brightgreen.svg)]()

---

## Features

- **Spec-Compliant**: 100% compliant with RFC 8259 (primitives, surrogate pairs, strict number rules, reviver).
- **Pinpoint Error Diagnostics**: Unprecedented syntax error reporting showing exact line, column, and a visual code pointer (`^`) directly highlighting the offending token.
- **Interactive React JSX Component (`<JsonParser />`)**:
  - Live validation and error highlighting as you type.
  - Interactive collapsible tree view with type-colored badges and item counts.
  - One-click formatting (2 or 4 spaces), minification, and clipboard copy.
- **AST Generation (`parseToAST`)**: Parse JSON into an Abstract Syntax Tree with full source location spans (`start`, `end`, `offset`).
- **Configurable Relaxed Extensions**: Optional support for comments (`//` and `/* */`), trailing commas, single-quoted strings, unquoted keys, and hex/Infinity/NaN numbers.
- **Full Serializer (`stringify`)**: Feature-complete drop-in replacement for `JSON.stringify` with circular structure detection, indentation, and custom replacers.
- **Zero Runtime Dependencies**: Ultra-lightweight and fast.
- **Built-in CLI**: Validate, format, minify, or inspect JSON from the terminal.

---

## Installation

```bash
npm install craft-json
```

---

## Quick Start

### 1. JavaScript Parser & Serializer

```javascript
import { parse, stringify, parseToAST } from 'craft-json';

// Standard parsing
const data = parse('{"name": "craft-json", "version": 1}');
console.log(data.name); // "craft-json"

// Parsing with ECMAScript reviver
const revived = parse('{"created": "2026-11-22T00:00:00.000Z"}', (key, value) => {
  if (key === 'created') return new Date(value);
  return value;
});

// Stringify with formatting
const jsonString = stringify(data, null, 2);
```

### 2. React JSX Component

```jsx
import React from 'react';
import { JsonParser } from 'craft-json/jsx';

export default function App() {
  const handleParse = (parsedData, ast) => {
    console.log('Successfully parsed:', parsedData);
  };

  const handleError = (error) => {
    console.warn('Syntax error:', error.message);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Interactive JSON Parser</h1>
      <JsonParser
        initialValue='{"name": "craft-json", "version": 1, "active": true}'
        onParse={handleParse}
        onError={handleError}
        theme="dark"
        height="550px"
      />
    </div>
  );
}
```

---

## Pinpoint Error Diagnostics

Unlike native `JSON.parse` which throws unhelpful errors like `Unexpected token , in JSON at position 28`, `craft-json` gives you visual code frame snippets:

```
JSONSyntaxError: Unexpected token ',' at line 3, column 13 (offset 46):

  1 | {
  2 |   "name": "craft-json",
> 3 |   "broken": ,
    |             ^
  4 | }
```

Every error object includes:
- `err.line`: 1-based line number
- `err.column`: 1-based column number
- `err.position`: 0-based character offset
- `err.snippet`: Formatted code frame
- `err.formattedMessage`: Complete diagnostic string

---

## Relaxed Mode (Comments, Trailing Commas, Unquoted Keys)

```javascript
import { parse } from 'craft-json';

const relaxedJson = `
  // Configuration
  {
    /* Application name */
    name: 'craft-json',       // Unquoted key & single quotes
    port: 8080,               // Trailing commas allowed
    cache: 0xFF,              // Hexadecimal numbers
  }
`;

const config = parse(relaxedJson, {
  allowComments: true,
  allowTrailingCommas: true,
  allowSingleQuotes: true,
  allowUnquotedKeys: true,
  allowNumericExtensions: true,
});
```

---

## AST Parser Mode (`parseToAST`)

Extract the exact Abstract Syntax Tree for custom linters, formatters, or IDE tooling:

```javascript
import { parseToAST } from 'craft-json';

const ast = parseToAST('{"price": 42}');
console.log(ast);
```

Yields:
```json
{
  "type": "Object",
  "loc": {
    "start": { "line": 1, "column": 1, "offset": 0 },
    "end": { "line": 1, "column": 14, "offset": 13 }
  },
  "raw": "{\"price\": 42}",
  "properties": [
    {
      "type": "Property",
      "key": {
        "type": "String",
        "value": "price",
        "loc": { "start": { "line": 1, "column": 2, "offset": 1 }, "end": { "line": 1, "column": 9, "offset": 8 } },
        "raw": "\"price\""
      },
      "value": {
        "type": "Number",
        "value": 42,
        "loc": { "start": { "line": 1, "column": 11, "offset": 10 }, "end": { "line": 1, "column": 13, "offset": 12 } },
        "raw": "42"
      }
    }
  ]
}
```

---

## CLI Usage

Run directly with `npx` or install globally:

```bash
# Pretty-print formatted JSON
craft-json -i 2 input.json

# Minify from stdin
cat data.json | craft-json --minify

# Validate JSON
craft-json --validate input.json

# Print AST
craft-json --ast input.json

# Enable relaxed parsing
craft-json --relaxed config.json
```

---

## API Reference

### `parse(text, optionsOrReviver?)`
- `text` *(string)*: The JSON string to parse.
- `optionsOrReviver` *(object | Function)*:
  - `reviver`: Function `(key, value) => any`
  - `allowComments` *(boolean)*: Allow `//` and `/* */` comments (default `false`)
  - `allowTrailingCommas` *(boolean)*: Allow trailing commas (default `false`)
  - `allowSingleQuotes` *(boolean)*: Allow `'...'` (default `false`)
  - `allowUnquotedKeys` *(boolean)*: Allow unquoted keys (default `false`)
  - `allowNumericExtensions` *(boolean)*: Allow `0x..`, `Infinity`, `NaN` (default `false`)
  - `disallowDuplicateKeys` *(boolean)*: Disallow duplicate object keys (default `false`)
  - `maxDepth` *(number)*: Maximum nesting depth (default `512`)

### `stringify(value, replacerOrOptions?, space?)`
- ECMAScript compliant serialization with cycle detection and custom indentation.

### `parseToAST(text, options?)`
- Generates a full Abstract Syntax Tree with source positions.

### `<JsonParser />` (JSX Component)
- `initialValue` *(string)*: Initial JSON string
- `onParse` *(Function)*: Called with `(parsedValue, astNode)`
- `onError` *(Function)*: Called with syntax error
- `theme` *("dark" | "light")*: Visual theme (default `"dark"`)
- `height` *(string)*: Container height (default `"540px"`)
- `showToolbar` *(boolean)*: Show toolbar (default `true`)

---

## License

MIT © [Rakshat Agarwal](https://github.com/)
