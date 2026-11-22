const ESCAPES = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

const CONTROL_OR_QUOTE_REGEX = /[\\"\u0000-\u001f]/g;

function escapeChar(char) {
  if (ESCAPES[char]) {
    return ESCAPES[char];
  }
  const code = char.charCodeAt(0);
  return `\\u${code.toString(16).padStart(4, '0')}`;
}

export function escapeString(str) {
  return `"${str.replace(CONTROL_OR_QUOTE_REGEX, escapeChar)}"`;
}

/**
 * Converts a JavaScript value to a JSON string.
 * Strictly compliant with ECMAScript JSON.stringify specification.
 * @param {any} value
 * @param {Function|Array|object} [replacerOrOptions]
 * @param {string|number} [spaceParam]
 * @returns {string|undefined}
 */
export function stringify(value, replacerOrOptions, spaceParam) {
  let replacerFunc;
  let propertyList;
  let indentStr = '';

  if (typeof replacerOrOptions === 'function') {
    replacerFunc = replacerOrOptions;
  } else if (Array.isArray(replacerOrOptions)) {
    propertyList = [];
    for (const item of replacerOrOptions) {
      if (typeof item === 'string' || typeof item === 'number') {
        const key = String(item);
        if (!propertyList.includes(key)) {
          propertyList.push(key);
        }
      }
    }
  } else if (replacerOrOptions && typeof replacerOrOptions === 'object') {
    const opts = replacerOrOptions;
    if (typeof opts.replacer === 'function') {
      replacerFunc = opts.replacer;
    } else if (Array.isArray(opts.replacer)) {
      propertyList = [];
      for (const item of opts.replacer) {
        if (typeof item === 'string' || typeof item === 'number') {
          const key = String(item);
          if (!propertyList.includes(key)) {
            propertyList.push(key);
          }
        }
      }
    }
    if (opts.space !== undefined) {
      spaceParam = opts.space;
    }
  }

  if (typeof spaceParam === 'number') {
    const num = Math.min(10, Math.max(0, Math.floor(spaceParam)));
    indentStr = ' '.repeat(num);
  } else if (typeof spaceParam === 'string') {
    indentStr = spaceParam.slice(0, 10);
  }

  const stack = new Set();

  function serialize(holder, key, depth) {
    let val = holder[key];

    // toJSON support
    if (val !== null && typeof val === 'object' && typeof val.toJSON === 'function') {
      val = val.toJSON(key);
    }

    // Replacer function call
    if (replacerFunc) {
      val = replacerFunc.call(holder, key, val);
    }

    if (typeof val === 'bigint') {
      throw new TypeError('Do not know how to serialize a BigInt');
    }

    if (val === null) {
      return 'null';
    }

    const type = typeof val;

    if (type === 'boolean') {
      return val ? 'true' : 'false';
    }

    if (type === 'string') {
      return escapeString(val);
    }

    if (type === 'number') {
      return isFinite(val) ? String(val) : 'null';
    }

    if (type === 'undefined' || type === 'function' || type === 'symbol') {
      return undefined;
    }

    // Object or Array
    if (type === 'object') {
      if (stack.has(val)) {
        throw new TypeError('Converting circular structure to JSON');
      }
      stack.add(val);

      let stepIndent = '';
      let nextIndent = '';

      if (indentStr) {
        stepIndent = indentStr.repeat(depth);
        nextIndent = indentStr.repeat(depth + 1);
      }

      try {
        if (Array.isArray(val)) {
          if (val.length === 0) {
            return '[]';
          }
          const elements = [];
          for (let i = 0; i < val.length; i++) {
            const str = serialize(val, String(i), depth + 1);
            elements.push(str === undefined ? 'null' : str);
          }
          if (indentStr) {
            return `[\n${nextIndent}${elements.join(`,\n${nextIndent}`)}\n${stepIndent}]`;
          }
          return `[${elements.join(',')}]`;
        } else {
          // Object
          const keys = propertyList ?? Object.keys(val);
          const pairs = [];

          for (const k of keys) {
            const str = serialize(val, k, depth + 1);
            if (str !== undefined) {
              const colon = indentStr ? ': ' : ':';
              pairs.push(`${escapeString(k)}${colon}${str}`);
            }
          }

          if (pairs.length === 0) {
            return '{}';
          }

          if (indentStr) {
            return `{\n${nextIndent}${pairs.join(`,\n${nextIndent}`)}\n${stepIndent}}`;
          }
          return `{${pairs.join(',')}}`;
        }
      } finally {
        stack.delete(val);
      }
    }

    return undefined;
  }

  const wrapper = { '': value };
  return serialize(wrapper, '', 0);
}
