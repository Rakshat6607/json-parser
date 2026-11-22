/**
 * AST Node factory helpers
 */

export function createASTObject(properties, loc, raw) {
  return {
    type: 'Object',
    properties,
    loc,
    raw,
  };
}

export function createASTProperty(key, value, loc, raw) {
  return {
    type: 'Property',
    key,
    value,
    loc,
    raw,
  };
}

export function createASTArray(elements, loc, raw) {
  return {
    type: 'Array',
    elements,
    loc,
    raw,
  };
}

export function createASTString(value, loc, raw) {
  return {
    type: 'String',
    value,
    loc,
    raw,
  };
}

export function createASTNumber(value, loc, raw) {
  return {
    type: 'Number',
    value,
    loc,
    raw,
  };
}

export function createASTBoolean(value, loc, raw) {
  return {
    type: 'Boolean',
    value,
    loc,
    raw,
  };
}

export function createASTNull(loc, raw) {
  return {
    type: 'Null',
    value: null,
    loc,
    raw,
  };
}
