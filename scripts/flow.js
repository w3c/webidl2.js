#!/usr/bin/env node
//@flow
'use strict';

const fs = require('fs');

//$FlowFixMe: Need to define this.
const parse = require('../lib/webidl2').parse;

const filepath = process.argv[2];
const out = process.argv[3];
print(filepath, out);

/**
 * @param {string} filepath
 * @param {string} [out="./"]
 * @returns {void}
 * @throws {Error}
 */
function print(filepath /* : string */, out /* : ?string */) /* : void */ {
  const dir = out || './';
  const unparsed = fs.readFileSync(filepath).toString();
  const idlDefinitions = parse(unparsed);
  const flowDeclarations /* : Array<[string, string]> */ = printIDLDefinitions(idlDefinitions);
  flowDeclarations.forEach(pair => {
    const name = pair[0];
    const flowDeclaration = pair[1];
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
    fs.writeFileSync(`${dir}/${name.toLowerCase()}.js`, flowDeclaration);
  });
}

/**
 * @param {IDLArgument} arg
 * @returns {string}
 */
function printIDLArgument(arg /* : IDLArgument */) /* : string */ {
  return `${arg.name}${arg.optional ? '?' : ''}: ${printIDLType(arg.idlType)}`;
}

/**
 * @param {Array<IDLArgument>} args
 * @returns {string}
 */
function printIDLArguments(args /* : Array<IDLArgument> */) /* : string */ {
  return args.map(printIDLArgument).join(', ');
}

/**
 * @param {IDLAttributeMember} idlAttributeMember
 * @returns {string}
 */
function printIDLAttributeMember(idlAttributeMember /* : IDLAttributeMember */) /* : string */ {
  return `  ${idlAttributeMember.name}: ${printIDLType(idlAttributeMember.idlType)};`;
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
      return printIDLInterface(idlDefinition);
    case 'typedef':
      // NOTE(mroberts): WebIDL cannot represent a type which is an empty Array,
      // nor can it represent "pairs" (e.g., an Array of length two); so we
      // special case these here.
      if (idlDefinition.name === 'EmptyArray'
       || idlDefinition.name === 'PairOfIDLTypes') {
        return null;
      }
      return printIDLTypedef(idlDefinition);
    default:
      throw new Error(`I don't know how to print ${idlDefinition.type}s`);
  }
}

/**
 * @param {Array<IDLDefinition>} idlDefinitions
 * @returns {Array<Array<string>>}
 * @throws {Error}
 */
function printIDLDefinitions(idlDefinitions /* : Array<IDLDefinition> */) /* : Array<[string, string]> */ {
  const flowDeclarations = [];
  for (let idlDefinition of idlDefinitions) {
    const flowDeclaration = printIDLDefinition(idlDefinition);
    if (flowDeclaration && idlDefinition.type !== 'implements') {
      flowDeclarations.push([idlDefinition.name, flowDeclaration]);
    }
  }
  return flowDeclarations;
}

/**
 * @param {IDLDictionary} idlDictionary
 * @returns {string}
 */
function printIDLDictionary(idlDictionary /* : IDLDictionary */) /* : string */ {
  const n = idlDictionary.members.length;
  return `type ${idlDictionary.name} = {
${idlDictionary.members.map((member, i) => {
  return `  ${member.name}${member.required ? '' : '?'}: ${printIDLType(member.idlType)}${i === n-1 ? '' : ','}`;
}).join('\n')}
};
`;
}

/**
 * @param {IDLEnum} idlEnum
 * @returns {string}
 */
function printIDLEnum(idlEnum /* : IDLEnum */) /* : string */ {
  const n = idlEnum.values.length;
  return `type ${idlEnum.name}
${idlEnum.values.map((value, i) => {
  return `  ${i ? '|' : '='} ${JSON.stringify(value)}${i === n-1 ? ';' : ''}`;
}).join('\n')}
`;
}

/**
 * @param {IDLInterface} idlInterface
 * @returns {string}
 * @throws {Error}
 */
function printIDLInterface(idlInterface /* : IDLInterface */) /* : string */ {
  let out = `declare interface ${idlInterface.name}${idlInterface.inheritance ? ` extends ${idlInterface.inheritance}` : ''} {\n`;
  if (idlInterface.members.length) {
    out += printIDLMembers(idlInterface.members);
  }
  return out + '\n};\n';
}

/**
 * @param {IDLMember} idlMember
 * @returns {string}
 * @throws {Error}
 */
function printIDLMember(idlMember /* : IDLMember */) /* : string */ {
  switch (idlMember.type) {
    case 'attribute':
      return printIDLAttributeMember(idlMember);
    default:
      throw new Error(`I don't know how to print ${idlMember.type}s`);
  }
}

/**
 * @param {IDLMember} idlMembers
 * @returns {string}
 * @throws {Error}
 */
function printIDLMembers(idlMembers /* : Array<IDLMember> */) /* : string */ {
  return idlMembers.map(printIDLMember).join('\n');
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
    // special case these here.
    if (type === 'PairOfIDLTypes') {
      type = '[IDLType, IDLType]';
    } else if (type === 'EmptyArray') {
      type = '[]';
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
  const n = idlTypedef.idlType.idlType.length;
  return `type ${idlTypedef.name}
${idlTypedef.idlType.idlType.map((idlType, i) => {
  return `  ${i ? '|' : '='} ${printIDLType(idlType)}${i === n-1 ? ';' : ''}`;
}).join('\n')}
`;
}
