export as namespace WebIDL2;

export function parse(str: string, opt?: ParseOptions): Array<IDLDefinition>;

export type FloatType
  = 'float'
  | 'double'
  | 'unrestricted float'
  | 'unrestricted double';

export type IDLArgument = {
  optional: boolean,
  variadic: boolean,
  extAttrs: Array<IDLExtendedAttribute>,
  idlType: IDLType,
  name: string,
  default?: IDLValue
};

export type IDLAttributeMember = {
  type: 'attribute',
  static: boolean,
  stringifier: boolean,
  inherit: boolean,
  readonly: boolean,
  idlType: IDLType,
  name: string,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLBooleanValue = {
  type: 'boolean',
  value: boolean
};

export type IDLCallback = {
  type: 'callback',
  name: string,
  idlType: IDLType|'void',
  arguments: Array<IDLArgument>,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLCallbackInterface = {
  type: 'callback interface',
  name: string,
  partial: boolean,
  members: Array<IDLMember>,
  inheritance: string|null,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLConstantMember = {
  type: 'const',
  nullable: boolean,
  idlType: PrimitiveType|string,
  value: IDLValue,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLDefinition
  = IDLCallback
  | IDLCallbackInterface
  | IDLDictionary
  | IDLEnum
  | IDLException
  | IDLImplements
  | IDLInterface
  | IDLTypedef;

export type IDLDictionary = {
  type: 'dictionary',
  name: string,
  partial: boolean,
  members: Array<IDLDictionaryFieldMember>,
  inheritance: string|null,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLDictionaryFieldMember = {
  type: 'field',
  name: string,
  required: boolean,
  idlType: IDLType,
  default?: IDLValue,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLEnum = {
  type: 'enum',
  name: string,
  values: Array<string>,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLException = {
  type: 'exception',
  name: string,
  members: Array<IDLConstantMember|IDLExceptionFieldMember>,
  inheritance: string|null,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLExceptionFieldMember = {
  type: 'field',
  name: string,
  idlType: IDLType,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLExtendedAttribute = {
  name: string,
  arguments: Array<IDLArgument>|null,
  rhs?: IDLExtendedAttributeRHS
};

export type IDLExtendedAttributeRHS = {
  type: IDLExtendedAttributeRHSType,
  value: string|Array<string>
};

export type IDLExtendedAttributeRHSType
  = 'identifier'
  | 'float'
  | 'integer'
  | 'string'
  | 'identifier-list';

export type IDLImplements = {
  type: 'implements',
  target: string,
  implements: string,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLInfinityValue = {
  type: 'Infinity',
  negative: boolean
};

export type IDLInterface = {
  type: 'interface',
  name: string,
  partial: boolean,
  members: Array<IDLMember>,
  inheritance: string|null,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLIterableMember = {
  type: 'iterable',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLIteratorMember = {
  type: 'iterator',
  getter: boolean,
  setter: boolean,
  creator: boolean,
  deleter: boolean,
  legacycaller: boolean,
  static: boolean,
  stringifier: boolean,
  idlType: IDLType|'void',
  iteratorObject?: string,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLLegacyIterableMember = {
  type: 'legacyiterable',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLMaplikeMember = {
  type: 'maplike',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLMember
  = IDLAttributeMember
  | IDLConstantMember
  | IDLDictionaryFieldMember
  | IDLExceptionFieldMember
  | IDLIterableMember
  | IDLIteratorMember
  | IDLLegacyIterableMember
  | IDLMaplikeMember
  | IDLNamedSerializerMember
  | IDLOperationMember
  | IDLSerializerMember
  | IDLSerializerOperationMember
  | IDLSerializerPatternListMember
  | IDLSerializerPatternMapMember
  | IDLSetlikeMember
  | IDLTypedef;

export type IDLNamedSerializerMember = {
  type: 'serializer',
  name: string,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLNaNValue = {
  type: 'NaN'
};

export type IDLNullValue = {
  type: 'null'
};

export type IDLNumberValue = {
  type: 'number',
  value: number
};

export type IDLOperationMember = {
  type: 'operation',
  getter: boolean,
  setter: boolean,
  creator: boolean,
  deleter: boolean,
  legacycaller: boolean,
  static: boolean,
  stringifier: boolean,
  idlType?: IDLType|'void',
  name: string|null,
  arguments: Array<IDLArgument>,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLSequenceValue = {
  type: 'sequence',
  value: Array<any>
};

export type IDLSerializerMember = {
  type: 'serializer',
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLSerializerOperation = {
  name: string,
  arguments: Array<IDLArgument>
};

export type IDLSerializerOperationMember = {
  type: "serializer",
  idlType: IDLType,
  operation: IDLSerializerOperation,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLSerializerPatternListMember = {
  type: 'serializer',
  patternList: true,
  names: Array<string>,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLSerializerPatternMapMember = {
  type: 'serializer',
  patternMap: true,
  names: Array<string>,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLSetlikeMember = {
  type: 'setlike',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLStringValue = {
  type: 'string',
  value: string
};

export type IDLType = {
  sequence: boolean,
  array: boolean|number,
  generic: string|null,
  idlType: IDLType|Array<IDLType>|PrimitiveType|string,
  nullable: boolean,
  nullableArray?: Array<boolean>,
  union: boolean
};

export type IDLTypedef = {
  type: 'typedef',
  typeExtAttrs: Array<IDLExtendedAttribute>,
  idlType: IDLType,
  name: string,
  extAttrs: Array<IDLExtendedAttribute>
};

export type IDLValue
  = IDLBooleanValue
  | IDLInfinityValue
  | IDLNaNValue
  | IDLNullValue
  | IDLNumberValue
  | IDLSequenceValue
  | IDLStringValue;

export type IntegerType
  = 'short'
  | 'long'
  | 'long long'
  | 'unsigned short'
  | 'unsigned long'
  | 'unsigned long long';

export type IterableType
  = 'iterable'
  | 'legacyiterable'
  | 'maplike'
  | 'setlike';

export type ParseOptions = {
  allowNestedTypedefs?: boolean
};

export type PrimitiveType
  = IntegerType
  | FloatType
  | 'boolean'
  | 'byte'
  | 'octet';

export type ReadonlyIterableType
  = 'maplike'
  | 'setlike';

export type Token = {
  type: TokenType,
  value: string
};

export type TokenType
  = 'float'
  | 'integer'
  | 'identifier'
  | 'string'
  | 'whitespace'
  | 'other';

export class WebIDLParseError {
  constructor(message: string, line: number, input: string, tokens: Array<Token>);
  message: string;
  line: number;
  input: string;
  tokens: Array<Token>;
}
