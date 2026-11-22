#!/usr/bin/env node

import * as fs from 'node:fs';
import * as process from 'node:process';
import { parse, parseToAST, stringify, JSONSyntaxError } from '../src/index.js';

function printHelp() {
  console.log(`
craft-json CLI - Fast, spec-compliant JSON parser and formatter

Usage:
  craft-json [options] [file]
  cat file.json | craft-json [options]

Options:
  -i, --indent <num>      Format and pretty-print JSON with indentation spaces (default: 2)
  -m, --minify            Minify JSON output
  -v, --validate          Validate JSON without outputting content
  --ast                   Output Abstract Syntax Tree (AST) with source locations
  --relaxed               Enable relaxed parsing (comments, trailing commas, single quotes)
  -h, --help              Show this help message
  --version               Show version
`);
}

async function readInput(filePath) {
  if (filePath && filePath !== '-') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version')) {
    console.log('craft-json v1.0.0');
    process.exit(0);
  }

  let indent = 2;
  let minify = false;
  let validateOnly = false;
  let outputAST = false;
  let relaxed = false;
  let filePath;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-i' || arg === '--indent') {
      indent = parseInt(args[++i] || '2', 10);
    } else if (arg === '-m' || arg === '--minify') {
      minify = true;
    } else if (arg === '-v' || arg === '--validate') {
      validateOnly = true;
    } else if (arg === '--ast') {
      outputAST = true;
    } else if (arg === '--relaxed') {
      relaxed = true;
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }

  const rawInput = await readInput(filePath);

  if (!rawInput.trim()) {
    console.error('Error: No input provided.');
    process.exit(1);
  }

  const parseOptions = relaxed
    ? {
        allowComments: true,
        allowTrailingCommas: true,
        allowSingleQuotes: true,
        allowUnquotedKeys: true,
        allowNumericExtensions: true,
      }
    : {};

  try {
    if (outputAST) {
      const ast = parseToAST(rawInput, parseOptions);
      console.log(JSON.stringify(ast, null, 2));
      process.exit(0);
    }

    const parsed = parse(rawInput, parseOptions);

    if (validateOnly) {
      console.log('\x1b[32m✔ Valid JSON\x1b[0m');
      process.exit(0);
    }

    if (minify) {
      console.log(stringify(parsed));
    } else {
      console.log(stringify(parsed, null, indent));
    }
  } catch (err) {
    if (err instanceof JSONSyntaxError) {
      console.error(`\x1b[31m${err.formattedMessage}\x1b[0m`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
