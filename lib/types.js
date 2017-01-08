'use strict';

/**
 * @readonly
 * @enum {string}
 */
const FloatType = {
  float: 'float',
  double: 'double',
  'unrestricted float': 'unrestricted float',
  'unrestricted double': 'unrestricted double'
};

/**
 * @interface IDLArgument
 * @property {boolean} optional
 * @property {boolean} variadic
 * @property {Array<IDLExtendedAttribute>} extAttrs
 * @property {IDLType} idlType
 * @property {string} name
 * @property {default} [IDLValue]
 */

/**
 * @interface IDLAttributeMember
 * @property {string} type - always "attribute"
 * @property {boolean} static
 * @property {boolean} stringifier
 * @property {boolean} inherit
 * @property {boolean} readonly
 * @property {IDLType} idlType
 * @property {string} name
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLBooleanValue
 * @property {string} type - always "boolean"
 * @property {boolean} value
 */

/**
 * @interface IDLCallback
 * @property {string} type - always "callback"
 * @property {string} name
 * @property {IDLType|string} - an {@link IDLType} or "void"
 * @property {Array<IDLArgument>} arguments
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLCallbackInterface
 * @property {string} type - always "callback interface"
 * @property {string} name
 * @property {boolean} partial
 * @property {Array<IDLMember>} members
 * @property {?string} inheritance
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLConstantMember
 * @property {string} type - always "const"
 * @property {boolean} nullable
 * @property {PrimitiveType|string} idlType
 * @property {IDLValue} value
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @typedef { IDLCallback
 *          | IDLCallbackInterface
 *          | IDLDictionary
 *          | IDLEnum
 *          | IDLException
 *          | IDLImplements
 *          | IDLInterface
 *          | IDLTypedef
 *          } IDLDefinition
 */

/**
 * @interface IDLDictionary
 * @property {string} type - always "dictionary"
 * @property {string} name
 * @property {boolean} partial
 * @property {Array<IDLDictionaryFieldMember>} members
 * @property {?string} inheritance
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLDictionaryFieldMember
 * @property {string} type - always "field"
 * @property {string} name
 * @property {boolean} required
 * @property {IDLType} idlType
 * @property {IDLValue} [default]
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLEnum
 * @property {string} type - always "enum"
 * @property {string} name
 * @property {Array<string>} values
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLException
 * @property {string} type - always "exception"
 * @property {string} name
 * @property {Array<IDLConstantMember|IDLExceptionFieldMember>} members
 * @property {?string} inheritance
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLExceptionFieldMember
 * @property {string} type - always "field"
 * @property {string} name
 * @property {IDLType} idlType
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLExtendedAttribute
 * @property {string} name
 * @property {?Array<IDLArgument>} arguments
 * @property {IDLExtendedAttributeRHS} [rhs]
 */

/**
 * @interface IDLExtendedAttributeRHS
 * @property {IDLExtendedAttributeRHSType} type
 * @property {string|Array<string>} value
 */

/**
 * @readonly
 * @enum {string}
 */
const IDLExtendedAttributeRHSType = {
  identifier: 'identifier',
  float: 'float',
  integer: 'integer',
  string: 'string',
  'identifier-list': 'identifier-list'
};

/**
 * @interface IDLImplements
 * @property {string} type - always "implements"
 * @property {string} target
 * @property {string} implements
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLInfinityValue
 * @property {string} type - always "Infinity"
 * @property {boolean} negative
 */

/**
 * @interface IDLInterface
 * @property {string} type - always "interface"
 * @property {string} name
 * @property {boolean} partial
 * @property {Array<IDLMember>} members
 * @property {?string} inheritance
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLIterableMember
 * @property {string} type - always "iterable"
 * @property {IDLType|Array<IDLType>} - an {@link IDLType} or a pair of {@link IDLType}s
 * @property {boolean} readonly
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLIteratorMember
 * @property {string} type - always "iterator"
 * @property {boolean} getter
 * @property {boolean} setter
 * @property {boolean} creator
 * @property {boolean} deleter
 * @property {boolean} legacycaller
 * @property {boolean} static
 * @property {boolean} stringifier
 * @property {IDLType|string} idlType - an {@link IDLType} or "void"
 * @property {string} [iteratorObject]
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLLegacyIterableMember
 * @property {string} type - always "legacyiterable"
 * @property {IDLType|Array<IDLType>} - an {@link IDLType} or a pair of {@link IDLType}s
 * @property {boolean} readonly
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLMaplikeMember
 * @property {string} type - always "maplike"
 * @property {IDLType|Array<IDLType>} - an {@link IDLType} or a pair of {@link IDLType}s
 * @property {boolean} readonly
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @typedef { IDLAttributeMember
 *          | IDLConstantMember
 *          | IDLDictionaryFieldMember
 *          | IDLExceptionFieldMember
 *          | IDLIterableMember
 *          | IDLIteratorMember
 *          | IDLLegacyIterableMember
 *          | IDLMaplikeMember
 *          | IDLNamedSerializerMember
 *          | IDLOperationMember
 *          | IDLSerializerMember
 *          | IDLSerializerOperationMember
 *          | IDLSerializerPatternListMember
 *          | IDLSerializerPatternMapMember
 *          | IDLSetlikeMember
 *          | IDLTypedef
 *          } IDLMember
 */

/**
 * @interface IDLNamedSerializerMember
 * @property {string} type - always "serializer"
 * @property {string} name
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLNaNValue
 * @property {string} type - always "NaN"
 */

/**
 * @interface IDLNullValue
 * @property {string} type - always "null"
 */

/**
 * @interface IDLNumberValue
 * @property {string} type - always "number"
 * @property {number} value
 */

/**
 * @interface IDLOperationMember
 * @property {string} type - always "operation"
 * @property {boolean} getter
 * @property {boolean} setter
 * @property {boolean} creator
 * @property {boolean} deleter
 * @property {boolean} legacycaller
 * @property {boolean} static
 * @property {boolean} stringifier
 * @property {IDLType|string} idlType - an {@link IDLType} or "void"
 * @property {?string} name
 * @property {Array<IDLArgument>} arguments
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLSequenceValue
 * @property {string} type - always "sequence"
 * @property {Array<*>} value - always the empty Array
 */

/**
 * @interface IDLSerializerMember
 * @property {string} type - always "serializer"
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLSerializerOperation
 * @property {string} name
 * @property {Array<IDLArgument>} arguments
 */

/**
 * @interface IDLSerializerOperationMember
 * @property {string} type - always "serializer"
 * @property {IDLType} idlType
 * @property {IDLSerializerOperation} operation
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLSerializerPatternListMember
 * @property {string} type - always "serializer"
 * @property {boolean} patternList - always true
 * @property {Array<string>} names
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLSerializerPatternMapMember
 * @property {string} type - always "serializer"
 * @property {boolean} patternMap - always true
 * @property {Array<string>} names
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLSetlikeMember
 * @property {string} type - always "setlike"
 * @property {IDLType|Array<IDLType>} - an {@link IDLType} or a pair of {@link IDLType}s
 * @property {boolean} readonly
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @interface IDLStringValue
 * @property {string} type - always "string"
 * @property {string} value
 */

/**
 * @interface IDLType
 * @property {boolean} sequence
 * @property {boolean|number} array
 * @property {?string} generic
 * @property {IDLType|Array<IDLType>|PrimitiveType|String} idlType
 * @property {boolean} nullable
 * @property {Array<boolean>} [nullableArray]
 * @property {boolean} union
 */

/**
 * @interface IDLTypedef
 * @property {string} type - always "typedef"
 * @property {Array<IDLExtendedAttribute>} typeExtAttrs
 * @property {IDLType} idlType
 * @property {string} name
 * @property {Array<IDLExtendedAttribute>} extAttrs
 */

/**
 * @typedef { IDBooleanValue
 *          | IDLInfinityValue
 *          | IDLNaNValue
 *          | IDLNullValue
 *          | IDLNumberValue
 *          | IDLSequenceValue
 *          | IDLStringValue
 *          } IDLValue
 */

/**
 * @readonly
 * @enum {string}
 */
const IntegerType = {
  short: 'short',
  long: 'long',
  'long long': 'long long',
  'unsigned short': 'unsigned short',
  'unsigned long': 'unsigned long',
  'unsigned long long': 'unsigned long long'
};

/**
 * @readonly
 * @enum {string}
 */
const IterableType = {
  iterable: 'iterable',
  legacyiterable: 'legacyiterable',
  maplike: 'maplike',
  setlike: 'setlike'
};

/**
 * @interface ParseOptions
 * @property {boolean} [allowNestedTypedefs]
 */

/**
 * A {@link PrimitiveType} is either an {@link IntegerType}, a
 * {@link FloatType}, or one of the string values "boolean", "byte", or "octet".
 * @typedef {IntegerType|FloatType|string} PrimitiveType
 */

/**
 * @readonly
 * @enum {string}
 */
const ReadonlyIterableType = {
  maplike: 'maplike',
  setlike: 'setlike'
};

/**
 * @interface Token
 * @property {TokenType} type
 * @property {string} value
 */

/**
 * @readonly
 * @enum {string}
 */
const TokenType = {
  float: 'float',
  integer: 'integer',
  identifier: 'identifier',
  string: 'string',
  whitespace: 'whitespace',
  other: 'other'
};
