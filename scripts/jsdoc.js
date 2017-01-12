#!/usr/bin/env node
//@flow
'use strict';

const fs = require('fs');

//$FlowFixMe: Need to define this.
const parse = require('../lib/webidl2').parse;

const filepath = process.argv[2];
print(filepath);

/**
 * @param {string} filepath
 * @returns {void}
 * @throws {Error}
 */
function print(filepath /* : string */) /* : void */ {
  const unparsed = fs.readFileSync(filepath).toString();
  const idlDefinitions = parse(unparsed);
  const typescript = `'use strict';

${printIDLDefinitions(idlDefinitions)}`;
  process.stdout.write(typescript);
}

/**
 * @param {IDLDefinition} idlDefinition
 * @returns {?string}
 * @throws {Error}
 */
function printIDLDefinition(idlDefinition /* : IDLDefinition */) /* : ?string */ {
  switch (idlDefinition.type) {
    case 'dictionary':
      return printIDLDictionary(idlDefinition);
    case 'enum':
      return printIDLEnum(idlDefinition);
    case 'interface':
      if (idlDefinition.name === 'WebIDLParseError') {
        return null;
      }
      break;
    case 'typedef':
      // NOTE(mroberts): WebIDL cannot represent a type which is an empty Array,
      // nor can it represent "pairs" (e.g., an Array of length two); so we
      // special case these here. JSDoc cannot either, so we do our best.
      if (idlDefinition.name === 'EmptyArray'
       || idlDefinition.name === 'PairOfIDLTypes') {
        return null;
      }
      return printIDLTypedef(idlDefinition);
  }
  throw new Error(`I don't know how to print ${idlDefinition.type}s`);
}

/**
 * @param {Array<IDLDefinition>} idlDefinitions
 * @returns {string}
 * @throws {Error}
 */
function printIDLDefinitions(idlDefinitions /* : Array<IDLDefinition> */) /* : string */ {
  const jsDocDefinitions = [];
  for (let idlDefinition of idlDefinitions) {
    const jsDocDefinition = printIDLDefinition(idlDefinition);
    if (jsDocDefinition) {
      jsDocDefinitions.push(jsDocDefinition);
    }
  }
  return jsDocDefinitions.join('\n');
}

/**
 * @param {IDLDictionary} idlDictionary
 * @returns {string}
 */
function printIDLDictionary(idlDictionary /* : IDLDictionary */) /* : string */ {
  return `/**
 * @interface ${idlDictionary.name}
${idlDictionary.members.map(member => {
  const type = member.required
    ? member.name
    : `[${member.name}]`;
  return ` * @property ${printIDLType(member.idlType)} ${type}`;
}).join('\n')}
 */
`;
}

/**
 * @param {IDLEnum} idlEnum
 * @returns {string}
 */
function printIDLEnum(idlEnum /* : IDLEnum */) /* : string */ {
  const n = idlEnum.values.length;
  return `/**
 * @readonly
 * @enum {string}
 */
const ${idlEnum.name} = {
${idlEnum.values.map((value, i) => {
  return `  ${JSON.stringify(value)}: ${JSON.stringify(value)}${i === n-1 ? '' : ','}`;
}).join('\n')}
};
`;
}

/**
 * @param {IDLType} idlType
 * @returns {string}
 */
function printIDLType(idlType /* : IDLType */) /* : string */ {
  let before = '';
  let after = '';
  if (idlType.generic) {
    const generic = idlType.generic === 'sequence' || idlType.generic === 'FrozenArray'
      ? 'Array'
      : idlType.generic;
    before = `${generic}<` + before;
    after += '>';
  }
  if (idlType.nullable) {
    before = '?' + before;
  }
  if (typeof idlType.idlType === 'string') {
    let type = idlType.idlType;
    // NOTE(mroberts): WebIDL cannot represent a type which is an empty Array,
    // nor can it represent "pairs" (e.g., an Array of length two); so we
    // special case these here. JSDoc cannot either, so we do our best.
    if (type === 'EmptyArray') {
      type = 'Array<*>';
    } else if (type === 'PairOfIDLTypes') {
      type = 'Array<IDLType>';
    }
    return `${before}${type}${after}`;
  } else if (Array.isArray(idlType.idlType)) {
    return `${before}${idlType.idlType.map(printIDLType).join('|')}${after}`;
  }
  return `${before}${printIDLType(idlType.idlType)}${after}`;
}

/**
 * @param {IDLTypedef} idlTypedef
 * @returns {string}
 * @throws {Error}
 */
function printIDLTypedef(idlTypedef /* : IDLTypedef */) /* : string */ {
  if (!Array.isArray(idlTypedef.idlType.idlType)) {
    throw new Error(`I only know how to print typedefs for unions`);
  }
  const types = idlTypedef.idlType.idlType.map(printIDLType).join('\n *          | ');
  return `/**
 * @typedef { ${types}
 *          } ${idlTypedef.name}
 */
`;
}
