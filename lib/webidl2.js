"use strict";

(() => {
  // These regular expressions use the sticky flag so they will only match at
  // the current location (ie. the offset of lastIndex).
  const tokenRe = {
    // This expression uses a lookahead assertion to catch false matches
    // against integers early.
    "float": /-?(?=[0-9]*\.|[0-9]+[eE])(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/y,
    "integer": /-?(0([Xx][0-9A-Fa-f]+|[0-7]*)|[1-9][0-9]*)/y,
    "identifier": /[_-]?[A-Za-z][0-9A-Z_a-z-]*/y,
    "string": /"[^"]*"/y,
    "whitespace": /[\t\n\r ]+/y,
    "comment": /((\/(\/.*|\*([^*]|\*[^/])*\*\/)[\t\n\r ]*)+)/y,
    "other": /[^\t\n\r 0-9A-Za-z]/y
  };

  const stringTypes = [
    "ByteString",
    "DOMString",
    "USVString"
  ];

  const argumentNameKeywords = [
    "attribute",
    "callback",
    "const",
    "deleter",
    "dictionary",
    "enum",
    "getter",
    "includes",
    "inherit",
    "interface",
    "iterable",
    "maplike",
    "namespace",
    "partial",
    "required",
    "setlike",
    "setter",
    "static",
    "stringifier",
    "typedef",
    "unrestricted"
  ];

  const nonRegexTerminals = [
    "-Infinity",
    "FrozenArray",
    "Infinity",
    "NaN",
    "Promise",
    "boolean",
    "byte",
    "double",
    "false",
    "float",
    "implements",
    "legacyiterable",
    "long",
    "mixin",
    "null",
    "octet",
    "optional",
    "or",
    "readonly",
    "record",
    "sequence",
    "short",
    "true",
    "unsigned",
    "void"
  ].concat(argumentNameKeywords, stringTypes);

  const punctuations = [
    "(",
    ")",
    ",",
    "...",
    ":",
    ";",
    "<",
    "=",
    ">",
    "?",
    "[",
    "]",
    "{",
    "}"
  ];

  function tokenise(str) {
    const tokens = [];
    let lastCharIndex = 0;
    let trivia = "";
    let line = 1;
    let index = 0;
    while (lastCharIndex < str.length) {
      const nextChar = str.charAt(lastCharIndex);
      let result = -1;

      if (/[\t\n\r ]/.test(nextChar)) {
        result = attemptTokenMatch("whitespace", { noFlushTrivia: true });
      } else if (nextChar === '/') {
        result = attemptTokenMatch("comment", { noFlushTrivia: true });
      }

      if (result !== -1) {
        const currentTrivia = tokens.pop().value;
        line += (currentTrivia.match(/\n/g) || []).length;
        trivia += currentTrivia;
        index -= 1;
      } else if (/[-0-9.A-Z_a-z]/.test(nextChar)) {
        result = attemptTokenMatch("float");
        if (result === -1) {
          result = attemptTokenMatch("integer");
        }
        if (result === -1) {
          result = attemptTokenMatch("identifier");
          const token = tokens[tokens.length - 1];
          if (result !== -1 && nonRegexTerminals.includes(token.value)) {
            token.type = token.value;
          }
        }
      } else if (nextChar === '"') {
        result = attemptTokenMatch("string");
      }

      for (const punctuation of punctuations) {
        if (str.startsWith(punctuation, lastCharIndex)) {
          tokens.push({ type: punctuation, value: punctuation, trivia, line, index });
          trivia = "";
          lastCharIndex += punctuation.length;
          result = lastCharIndex;
          break;
        }
      }

      // other as the last try
      if (result === -1) {
        result = attemptTokenMatch("other");
      }
      if (result === -1) {
        throw new Error("Token stream not progressing");
      }
      lastCharIndex = result;
      index += 1;
    }

    // remaining trivia as eof
    tokens.push({
      type: "eof",
      value: "",
      trivia
    });

    return tokens;

    function attemptTokenMatch(type, { noFlushTrivia } = {}) {
      const re = tokenRe[type];
      re.lastIndex = lastCharIndex;
      const result = re.exec(str);
      if (result) {
        tokens.push({ type, value: result[0], trivia, line, index });
        if (!noFlushTrivia) {
          trivia = "";
        }
        return re.lastIndex;
      }
      return -1;
    }
  }

  class WebIDLParseError extends Error {
    constructor(str, line, input, tokens) {
      super(str);
      this.name = this.constructor.name;
      this.line = line;
      this.input = input;
      this.tokens = tokens;
    }

    toString() {
      const tokens = JSON.stringify(this.tokens, null, 4);
      return `${this.message}\n${tokens}`;
    }
  }

  function parse(source) {
    source = source.slice();
    let current = null;

    const FLOAT = "float";
    const INT = "integer";
    const ID = "identifier";
    const STR = "string";

    function error(str) {
      const maxTokens = 5;
      const line =
        !probe("eof") ? source[consume_position].line :
        source.length > 1 ? source[consume_position - 1].line :
        1;

      const precedingLine = lastLine(
        tokensToText(sliceTokens(-maxTokens), { precedes: true })
      );

      const procedingTokens = sliceTokens(maxTokens);
      const procedingText = tokensToText(procedingTokens);
      const procedingLine = procedingText.split("\n")[0];

      const spaced = " ".repeat(precedingLine.length) + "^ " + str;
      const context = precedingLine + procedingLine + "\n" + spaced;

      const since = current ? `, since \`${current.partial ? "partial " : ""}${current.type} ${current.name}\`` : "";
      const message = `Syntax error at line ${line}${since}:\n${context}`;

      throw new WebIDLParseError(message, line, procedingText, procedingTokens);

      function sliceTokens(count) {
        return count > 0 ?
          source.slice(consume_position, consume_position + count) :
          source.slice(Math.max(consume_position + count, 0), consume_position);
      }

      function tokensToText(inputs, { precedes } = {}) {
        const text = inputs.map(t => t.trivia + t.value).join("");
        const nextToken = source[consume_position];
        if (nextToken.type === "eof") {
          return text;
        }
        if (precedes) {
          return text + nextToken.trivia;
        }
        return text.slice(nextToken.trivia.length);
      }

      function lastLine(text) {
        const splitted = text.split("\n");
        return splitted[splitted.length - 1];
      }
    }

    let consume_position = 0;

    function probe(type) {
      return source.length > consume_position && source[consume_position].type === type;
    }

    function consume(...candidates) {
      // TODO: use const when Servo updates its JS engine
      // eslint-disable-next-line prefer-const
      for (let type of candidates) {
        if (!probe(type)) continue;
        const token = source[consume_position];
        consume_position++;
        return token;
      }
    }

    function optional_consume(...args) {
      const token = consume(...args);
      if (token) {
        token.optional = true;
      }
      return token;
    }

    function untype_token(token) {
      if (!token) {
        return null;
      }
      const { value, trivia } = token;
      return { value, trivia };
    }

    function unvalue_token(token) {
      if (!token) {
        return null;
      }
      const { trivia } = token;
      return { trivia };
    }

    function unescape(identifier) {
      return identifier.startsWith('_') ? identifier.slice(1) : identifier;
    }

    function unconsume(position) {
      consume_position = position;
    }

    function list({ parser, required, listName = "list" }) {
      const first = parser();
      if (!first) {
        if (required) {
          error(`Found an empty ${listName}`);
        }
        return [];
      }
      const items = [first];
      while (first.separator) {
        const item = parser() || error(`Trailing comma in ${listName}`);
        items.push(item);
        if (!item.separator) break;
      }
      return items;
    }

    class Definition {
      constructor({ tokens }) {
        Object.defineProperties(this, {
          source: { value: source },
          tokens: { value: tokens }
        });
      }

      get trivia() {
        const object = {};
        for (const [key, value] of Object.entries(this.tokens)) {
          if (value && !value.optional) {
            object[key] = value.trivia;
          }
        }
        return object;
      }

      toJSON() {
        const json = { type: undefined, name: undefined, escapedName: undefined };
        let proto = this;
        while (proto !== Object.prototype) {
          const descMap = Object.getOwnPropertyDescriptors(proto);
          for (const [key, value] of Object.entries(descMap)) {
            if (value.enumerable || value.get) {
              json[key] = this[key];
            }
          }
          proto = Object.getPrototypeOf(proto);
        }
        return json;
      }
    }

    function integer_type() {
      const prefix = optional_consume("unsigned");
      const base = consume("short", "long");
      if (base) {
        const postfix = optional_consume("long");
        const type = new Type({ tokens: { prefix, base, postfix } });
        type.idlType = [prefix, base, postfix].filter(t => t).map(t => t.value).join(' ');
        return type;
      }
      if (prefix) error("Failed to parse integer type");
    }

    function float_type() {
      const prefix = optional_consume("unrestricted");
      const base = consume("float", "double");
      if (base) {
        const type = new Type({ tokens: { prefix, base } });
        type.idlType = [prefix, base].filter(t => t).map(t => t.value).join(' ');
        return type;
      }
      if (prefix) error("Failed to parse float type");
    }

    function primitive_type() {
      const num_type = integer_type() || float_type();
      if (num_type) return num_type;
      const base = consume("boolean", "byte", "octet");
      if (base) {
        const type = new Type({ tokens: { base } });
        type.idlType = type.baseName;
        return type;
      }
    }

    function const_value() {
      return consume("true", "false", "null", "Infinity", "-Infinity", "NaN", FLOAT, INT);
    }

    function const_data(token) {
      switch (token.type) {
        case "true":
        case "false":
          return { type: "boolean", value: token.type === "true" };
        case "Infinity":
        case "-Infinity":
          return { type: "Infinity", negative: token.type.startsWith("-") };
        case FLOAT:
        case INT:
          return { type: "number", value: token.value };
        case "[":
          return { type: "sequence", value: [] };
        case STR:
          return { type: STR, value: token.value.slice(1, -1) };
        default:
          return { type: token.type };
      }
    }

    function type_suffix(obj) {
      const nullable = optional_consume("?");
      if (nullable) {
        obj.tokens.nullable = nullable;
      }
      if (probe("?")) error("Can't nullable more than once");
    }

    class Type extends Definition {
      get generic() {
        return null;
      }
      get nullable() {
        return unvalue_token(this.tokens.nullable);
      }
      get union() {
        return false;
      }
      get baseName() {
        const { escapedBaseName } = this;
        if (!escapedBaseName) {
          return null;
        }
        return unescape(escapedBaseName);
      }
      get escapedBaseName() {
        if (!this.tokens.base) {
          return null;
        }
        return this.tokens.base.value;
      }
      get prefix() {
        return untype_token(this.tokens.prefix);
      }
      get postfix() {
        return untype_token(this.tokens.postfix);
      }
      get separator() {
        return untype_token(this.tokens.separator);
      }

      constructor({ tokens }) {
        super({ tokens });
        this.extAttrs = null;
      }

      toJSON() {
        return {
          type: this.type,
          generic: this.generic,
          nullable: this.nullable,
          union: this.union,
          idlType: this.idlType,
          baseName: this.baseName,
          escapedBaseName: this.escapedBaseName,
          prefix: this.prefix,
          postfix: this.postfix,
          separator: this.separator,
          extAttrs: this.extAttrs,
          trivia: this.trivia
        };
      }
    }

    class GenericType extends Type {
      static parse(typeName) {
        const base = consume("FrozenArray", "Promise", "sequence", "record");
        if (!base) {
          return;
        }
        const ret = new GenericType({ tokens: { base } });
        ret.tokens.open = optional_consume("<") || error(`No opening bracket after ${base.type}`);
        switch (base.type) {
          case "Promise":
            if (probe("[")) error("Promise type cannot have extended attribute");
            ret.idlType = [return_type(typeName)];
            break;
          case "sequence":
          case "FrozenArray":
            ret.idlType = [type_with_extended_attributes(typeName)];
            break;
          case "record": {
            if (probe("[")) error("Record key cannot have extended attribute");
            const keyType = consume(...stringTypes) || error(`Record key must be a string type`);
            const keyIdlType = new Type({ tokens: { base: keyType }});
            keyIdlType.tokens.separator = optional_consume(",") || error("Missing comma after record key type");
            keyIdlType.type = typeName;
            keyIdlType.idlType = keyIdlType.baseName;
            const valueType = type_with_extended_attributes(typeName) || error("Error parsing generic type record");
            ret.idlType = [keyIdlType, valueType];
            break;
          }
        }
        if (!ret.idlType) error(`Error parsing generic type ${base.type}`);
        ret.tokens.close = optional_consume(">") || error(`Missing closing bracket after ${base.type}`);
        return ret;
      }

      get generic() {
        return {
          value: this.baseName,
          trivia: {
            open: this.tokens.open.trivia,
            close: this.tokens.close.trivia,
          }
        };
      }
    }

    function single_type(typeName) {
      let ret = GenericType.parse(typeName) || primitive_type();
      if (!ret) {
        const base = consume(ID, ...stringTypes);
        if (!base) {
          return;
        }
        ret = new Type({ tokens: { base } });
        ret.idlType = ret.baseName;
        if (probe("<")) error(`Unsupported generic type ${base.value}`);
      }
      if (ret.generic && ret.generic.value === "Promise" && probe("?")) {
        error("Promise type cannot be nullable");
      }
      ret.type = typeName || null;
      type_suffix(ret);
      if (ret.nullable && ret.idlType === "any") error("Type `any` cannot be made nullable");
      return ret;
    }

    class UnionType extends Type {
      static parse(type) {
        const tokens = {};
        tokens.open = consume("(");
        if (!tokens.open) return;
        const ret = new UnionType({ tokens });
        ret.type = type || null;
        ret.idlType = [];
        while (true) {
          const typ = type_with_extended_attributes() || error("No type after open parenthesis or 'or' in union type");
          if (typ.idlType === "any") error("Type `any` cannot be included in a union type");
          ret.idlType.push(typ);
          const or = optional_consume("or");
          if (or) {
            typ.tokens.separator = or;
          }
          else break;
        }
        if (ret.idlType.length < 2) {
          error("At least two types are expected in a union type but found less");
        }
        tokens.close = consume(")") || error("Unterminated union type");
        type_suffix(ret);
        return ret;
      }

      get union() {
        return true;
      }
    }

    function type(typeName) {
      return single_type(typeName) || UnionType.parse(typeName);
    }

    function type_with_extended_attributes(typeName) {
      const extAttrs = ExtendedAttributes.parse();
      const ret = type(typeName);
      if (ret) ret.extAttrs = extAttrs;
      return ret;
    }

    class Argument extends Definition {
      static parse() {
        const start_position = consume_position;
        const tokens = {};
        const ret = new Argument({ tokens });
        tokens.optional = optional_consume("optional");
        ret.idlType = type_with_extended_attributes("argument-type");
        if (!ret.idlType) {
          return unconsume(start_position);
        }
        if (!tokens.optional) {
          tokens.variadic = optional_consume("...");
        }
        tokens.name = consume(ID, ...argumentNameKeywords);
        if (!tokens.name) {
          return unconsume(start_position);
        }
        if (tokens.optional) {
          ret.default = Default.parse() || null;
        }
        tokens.separator = optional_consume(",");
        return ret;
      }

      constructor({ tokens }) {
        super({ tokens });
        this.default = null;
      }

      get optional() {
        return unvalue_token(this.tokens.optional);
      }
      get variadic() {
        return unvalue_token(this.tokens.variadic);
      }
      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }
      get separator() {
        return untype_token(this.tokens.separator);
      }

      toJSON() {
        return {
          optional: this.optional,
          variadic: this.variadic,
          default: this.default,
          trivia: this.trivia,
          idlType: this.idlType,
          name: this.name,
          escapedName: this.escapedName,
          separator: this.separator
        };
      }
    }

    function argument_list() {
      return list({ parser: Argument.parse, listName: "arguments list" });
    }

    class Identifier extends Definition {
      static parse() {
        const value = consume(ID) || error("Expected identifiers but none found");
        const separator = optional_consume(",");
        return new Identifier({ tokens: { value, separator } });
      }

      get value() {
        return this.tokens.value.value;
      }
      get trivia() {
        return this.tokens.value.trivia;
      }
      get separator() {
        return untype_token(this.tokens.separator);
      }

      toJSON() {
        return {
          value: this.value,
          trivia: this.trivia,
          separator: this.separator
        };
      }
    }

    function identifiers() {
      const arr = [];
      const id = Identifier.parse();
      arr.push(id);
      while (id.separator) {
        const id = Identifier.parse();
        arr.push(id);
        if (!id.separator) break;
      }
      return arr;
    }

    class SimpleExtendedAttribute extends Definition {
      static parse() {
        const tokens = {};
        const args = { tokens };
        tokens.name = consume(ID);
        if (!tokens.name) {
          return;
        }
        tokens.assign = optional_consume("=");
        if (tokens.assign) {
          tokens.secondaryName = optional_consume(ID, FLOAT, INT, STR);
        }
        tokens.open = optional_consume("(");
        if (tokens.open) {
          args.list = (tokens.assign && !tokens.secondaryName) ?
            // [Exposed=(Window,Worker)]
            identifiers() :
            // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
            argument_list();
          tokens.close = optional_consume(")") || error("Unexpected token in extended attribute argument list");
        }
        const ret = new SimpleExtendedAttribute(args);
        if (tokens.assign && !ret.rhs) error("No right hand side to extended attribute assignment");
        tokens.separator = optional_consume(",");
        return ret;
      }

      constructor({ tokens, list }) {
        super({ tokens });
        Object.defineProperty(this, "list", { value: list });
      }

      get name() {
        return this.tokens.name.value;
      }
      get type() {
        return "extended-attribute";
      }
      get rhs() {
        const { assign, secondaryName } = this.tokens;
        if (!assign) {
          return null;
        }
        const trivia = { assign: assign.trivia };
        if (secondaryName) {
          return Object.assign({},
            secondaryName, {
              trivia: Object.assign(trivia, {
                value: secondaryName.trivia
              }),
              line: undefined,
              optional: undefined,
              index: undefined
            }
          );
        }
        return {
          type: "identifier-list",
          value: this.list,
          trivia: Object.assign(trivia, {
            open: this.tokens.open.trivia,
            close: this.tokens.close.trivia
          })
        };
      }
      get signature() {
        if (!this.list || (this.tokens.assign && !this.tokens.secondaryName)) {
          return null;
        }
        return {
          arguments: this.list,
          trivia: {
            open: this.tokens.open.trivia,
            close: this.tokens.close.trivia
          }
        };
      }
      get separator() {
        return untype_token(this.tokens.separator);
      }

      toJSON() {
        return {
          name: this.name,
          signature: this.signature,
          type: this.type,
          rhs: this.rhs,
          trivia: this.trivia,
          separator: this.separator
        };
      }
    }

    // Note: we parse something simpler than the official syntax. It's all that ever
    // seems to be used
    class ExtendedAttributes extends Definition {
      static parse() {
        const tokens = {};
        tokens.open = consume("[");
        if (!tokens.open) return null;
        const ret = new ExtendedAttributes({ tokens });
        ret.items = list({
          parser: SimpleExtendedAttribute.parse,
          required: true,
          listName: "extended attribute"
        });
        tokens.close = consume("]") || error("No end of extended attribute");
        return ret;
      }

      toJSON() {
        return {
          trivia: this.trivia,
          items: this.items
        };
      }
    }

    class Default extends Definition {
      static parse() {
        const assign = consume("=");
        if (!assign) {
          return;
        }

        const def = const_value() || consume(STR, "[")  || error("No value for default");
        const expression = [def];
        if (def.type === "[") {
          const close = consume("]") || error("Default sequence value must be empty");
          expression.push(close);
        }
        return new Default({ tokens: { assign }, expression });
      }

      constructor({ tokens, expression }) {
        super({ tokens });
        Object.defineProperties(this, {
          expression: { value: expression },
          data: { value: const_data(expression[0]) }
        });
      }

      get type() {
        return this.data.type;
      }
      get value() {
        return this.data.value;
      }
      get negative() {
        return this.data.negative;
      }
      get trivia() {
        const [first, second] = this.expression;
        const trivia = first.type === "[" ? {
          open: first.trivia,
          close: second.trivia
        } : { value: first.trivia };
        return Object.assign(super.trivia, trivia);
      }

      toJSON() {
        return {
          type: this.type,
          value: this.value,
          negative: this.negative,
          trivia: this.trivia,
        };
      }
    }

    class Constant extends Definition {
      static parse() {
        const tokens = {};
        tokens.base = consume("const");
        if (!tokens.base) {
          return;
        }
        let idlType = primitive_type();
        if (!idlType) {
          const base = consume(ID) || error("No type for const");
          idlType = new Type({ tokens: { base } });
          idlType.idlType = idlType.baseName;
        }
        idlType.type = "const-type";
        type_suffix(idlType);
        tokens.name = consume(ID) || error("No name for const");
        tokens.assign = consume("=") || error("No value assignment for const");
        tokens.value = const_value() || error("No value for const");
        tokens.termination = consume(";") || error("Unterminated const");
        const ret = new Constant({ tokens });
        ret.idlType = idlType;
        return ret;
      }

      get type() {
        return "const";
      }
      get name() {
        return unescape(this.tokens.name.value);
      }
      get value() {
        return const_data(this.tokens.value);
      }

      toJSON() {
        return {
          type: this.type,
          idlType: this.idlType,
          name: this.name,
          value: this.value,
          trivia: this.trivia,
          extAttrs: this.extAttrs,
        };
      }
    }

    class CallbackFunction extends Definition {
      static parse(base) {
        const tokens = { base };
        const ret = new CallbackFunction({ tokens });
        tokens.name = consume(ID) || error("No name for callback");
        current = ret;
        tokens.assign = consume("=") || error("No assignment in callback");
        ret.idlType = return_type() || error("Missing return type");
        tokens.open = consume("(") || error("No arguments in callback");
        ret.arguments = argument_list();
        tokens.close = consume(")") || error("Unterminated callback");
        tokens.termination = consume(";") || error("Unterminated callback");
        return ret;
      }

      get type() {
        return "callback";
      }
      get name() {
        return unescape(this.tokens.name.value);
      }

      toJSON() {
        return {
          type: this.type,
          name: this.name,
          idlType: this.idlType,
          arguments: this.arguments,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    function callback() {
      const callback = consume("callback");
      if (!callback) return;
      const tok = consume("interface");
      if (tok) {
        return Interface.parse(tok, { callback });
      }
      return CallbackFunction.parse(callback);
    }

    class Attribute extends Definition {
      static parse({ special, noInherit = false, readonly = false } = {}) {
        const start_position = consume_position;
        const tokens = { special };
        const ret = new Attribute({ tokens });
        if (!special && !noInherit) {
          tokens.special = optional_consume("inherit");
        }
        tokens.readonly = optional_consume("readonly");
        if (readonly && !tokens.readonly && probe("attribute")) {
          error("Attributes must be readonly in this context");
        }
        tokens.base = consume("attribute");
        if (!tokens.base) {
          unconsume(start_position);
          return;
        }
        ret.idlType = type_with_extended_attributes("attribute-type") || error("No type in attribute");
        switch (ret.idlType.generic && ret.idlType.generic.value) {
          case "sequence":
          case "record": error(`Attributes cannot accept ${ret.idlType.generic.value} types`);
        }
        tokens.name = consume(ID, "required") || error("No name in attribute");
        tokens.termination = consume(";") || error("Unterminated attribute");
        return ret;
      }

      get type() {
        return "attribute";
      }
      get special() {
        return untype_token(this.tokens.special);
      }
      get readonly() {
        return unvalue_token(this.tokens.readonly);
      }
      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }

      toJSON() {
        return {
          type: this.type,
          special: this.special,
          readonly: this.readonly,
          trivia: this.trivia,
          idlType: this.idlType,
          name: this.name,
          escapedName: this.escapedName,
          extAttrs: this.extAttrs
        };
      }
    }

    function return_type(typeName) {
      const typ = type(typeName || "return-type");
      if (typ) {
        return typ;
      }
      const voidToken = consume("void");
      if (voidToken) {
        const ret = new Type({ tokens: { base: voidToken } });
        ret.type = "return-type";
        ret.idlType = "void";
        return ret;
      }
    }

    class OperationBody extends Definition {
      static parse() {
        const tokens = {};
        const ret = new OperationBody({ tokens });
        ret.idlType = return_type() || error("Missing return type");
        tokens.name = optional_consume(ID);
        tokens.open = consume("(") || error("Invalid operation");
        ret.arguments = argument_list();
        tokens.close = consume(")") || error("Unterminated operation");
        return ret;
      }

      get name() {
        const { name } = this.tokens;
        if (!name) {
          return null;
        }
        return {
          value: unescape(name.value),
          escaped: name.value,
          trivia: name.trivia
        };
      }

      toJSON() {
        return {
          idlType: this.idlType,
          trivia: this.trivia,
          name: this.name,
          arguments: this.arguments
        };
      }
    }

    class Operation extends Definition {
      static parse({ special, regular } = {}) {
        const tokens = { special };
        const ret = new Operation({ tokens });
        if (special && special.value === "stringifier") {
          tokens.termination = consume(";");
          if (tokens.termination) {
            ret.body = null;
            return ret;
          }
        }
        if (!special && !regular) {
          tokens.special = optional_consume("getter", "setter", "deleter");
        }
        ret.body = OperationBody.parse();
        tokens.termination = consume(";") || error("Unterminated attribute");
        return ret;
      }

      get type() {
        return "operation";
      }
      get special() {
        return untype_token(this.tokens.special);
      }

      toJSON() {
        return {
          type: this.type,
          special: this.special,
          body: this.body,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    function static_member() {
      const special = optional_consume("static");
      if (!special) return;
      const member = Attribute.parse({ special }) ||
        Operation.parse({ special }) ||
        error("No body in static member");
      return member;
    }

    function stringifier() {
      const special = optional_consume("stringifier");
      if (!special) return;
      const member = Attribute.parse({ special }) ||
        Operation.parse({ special }) ||
        error("Unterminated stringifier");
      return member;
    }

    class IterableLike extends Definition {
      static parse() {
        const start_position = consume_position;
        const tokens = {};
        const ret = new IterableLike({ tokens });
        tokens.readonly = optional_consume("readonly");
        tokens.base = tokens.readonly ?
          consume("maplike", "setlike") :
          consume("iterable", "maplike", "setlike");
        if (!tokens.base) {
          unconsume(start_position);
          return;
        }

        const { type } = ret;
        const secondTypeRequired = type === "maplike";
        const secondTypeAllowed = secondTypeRequired || type === "iterable";

        tokens.open = consume("<") || error(`Error parsing ${type} declaration`);
        const first = type_with_extended_attributes() || error(`Error parsing ${type} declaration`);
        ret.idlType = [first];
        if (secondTypeAllowed) {
          first.tokens.separator = optional_consume(",");
          if (first.separator) {
            ret.idlType.push(type_with_extended_attributes());
          }
          else if (secondTypeRequired)
            error(`Missing second type argument in ${type} declaration`);
        }
        tokens.close = consume(">") || error(`Unterminated ${type} declaration`);
        tokens.termination = consume(";") || error(`Missing semicolon after ${type} declaration`);

        return ret;
      }

      get type() {
        return this.tokens.base.value;
      }
      get readonly() {
        return unvalue_token(this.tokens.readonly);
      }
    }

    class Inheritance extends Definition {
      static parse() {
        const colon = consume(":");
        if (!colon) {
          return;
        }
        const name = consume(ID) || error("No type in inheritance");
        return new Inheritance({ tokens: { colon, name } });
      }

      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }
    }

    class Container extends Definition {
      static parse(instance, { type, inheritable, allowedMembers }) {
        const { tokens } = instance;
        tokens.name = consume(ID) || error("No name for interface");
        current = instance;
        if (inheritable) {
          instance.inheritance = Inheritance.parse() || null;
        }
        tokens.open = consume("{") || error(`Bodyless ${type}`);
        instance.members = [];
        while (true) {
          tokens.close = consume("}");
          if (tokens.close) {
            tokens.termination = consume(";") || error(`Missing semicolon after ${type}`);
            return instance;
          }
          const ea = ExtendedAttributes.parse();
          let mem;
          for (const [parser, ...args] of allowedMembers) {
            mem = parser(...args);
            if (mem) {
              break;
            }
          }
          if (!mem) {
            error("Unknown member");
          }
          mem.extAttrs = ea;
          instance.members.push(mem);
        }
      }

      get partial() {
        return unvalue_token(this.tokens.partial);
      }
      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }
    }

    class Interface extends Container {
      static parse(base, { callback = null, partial = null } = {}) {
        const tokens = { callback, partial, base };
        return Container.parse(new Interface({ tokens }), {
          type: "interface",
          inheritable: !partial,
          allowedMembers: [
            [Constant.parse],
            [static_member],
            [stringifier],
            [IterableLike.parse],
            [Attribute.parse],
            [Operation.parse]
          ]
        });
      }

      get type() {
        if (this.tokens.callback) {
          return "callback interface";
        }
        return "interface";
      }
    }

    class Mixin extends Container {
      static parse(base, { partial } = {}) {
        const tokens = { partial, base };
        tokens.mixin = consume("mixin");
        if (!tokens.mixin) {
          return;
        }
        return Container.parse(new Mixin({ tokens }), {
          type: "interface mixin",
          allowedMembers: [
            [Constant.parse],
            [stringifier],
            [Attribute.parse, { noInherit: true }],
            [Operation.parse, { regular: true }]
          ]
        });
      }

      get type() {
        return "interface mixin";
      }
    }

    function interface_(opts) {
      const base = consume("interface");
      if (!base) return;
      const ret = Mixin.parse(base, opts) ||
        Interface.parse(base, opts) ||
        error("Interface has no proper body");
      return ret;
    }

    class Namespace extends Container {
      static parse({ partial } = {}) {
        const tokens = { partial };
        tokens.base = consume("namespace");
        if (!tokens.base) {
          return;
        }
        return Container.parse(new Namespace({ tokens }), {
          type: "namespace",
          allowedMembers: [
            [Attribute.parse, { noInherit: true, readonly: true }],
            [Operation.parse, { regular: true }]
          ]
        });
      }

      get type() {
        return "namespace";
      }
    }

    function partial() {
      const partial = optional_consume("partial");
      if (!partial) return;
      return Dictionary.parse({ partial }) ||
        interface_({ partial }) ||
        Namespace.parse({ partial }) ||
        error("Partial doesn't apply to anything");
    }

    class Dictionary extends Container {
      static parse({ partial } = {}) {
        const tokens = { partial };
        tokens.base = consume("dictionary");
        if (!tokens.base) {
          return;
        }
        return Container.parse(new Dictionary({ tokens }), {
          type: "dictionary",
          inheritable: !partial,
          allowedMembers: [
            [Field.parse],
          ]
        });
      }

      get type() {
        return "dictionary";
      }
    }

    class Field extends Definition {
      static parse() {
        const tokens = {};
        const ret = new Field({ tokens });
        ret.extAttrs = ExtendedAttributes.parse();
        tokens.required = optional_consume("required");
        ret.idlType = type_with_extended_attributes("dictionary-type") || error("No type for dictionary member");
        tokens.name = consume(ID) || error("No name for dictionary member");
        ret.default = Default.parse() || null;
        if (tokens.required && ret.default) error("Required member must not have a default");
        tokens.termination = consume(";") || error("Unterminated dictionary member");
        return ret;
      }

      get type() {
        return "field";
      }
      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }
      get required() {
        return unvalue_token(this.tokens.required);
      }
    }

    class Enum extends Definition {
      static parse() {
        const tokens = {};
        tokens.base = consume("enum");
        if (!tokens.base) {
          return;
        }
        tokens.name = consume(ID) || error("No name for enum");
        current = new Enum({ tokens });
        tokens.open = consume("{") || error("Bodyless enum");
        current.values = [];
        let value_expected = true;
        while (true) {
          tokens.close = consume("}");
          if (tokens.close) {
            if (!current.values.length) error("No value in enum");
            tokens.termination = consume(";") || error("No semicolon after enum");
            return current;
          }
          else if (!value_expected) {
            error("No comma between enum values");
          }
          const item = EnumItem.parse();
          current.values.push(item);
          value_expected = !!item.separator;
        }
      }

      get type() {
        return "enum";
      }
      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }
    }

    class EnumItem extends Definition {
      static parse() {
        const value = consume(STR) || error("Unexpected value in enum");
        const separator = optional_consume(",");
        return new EnumItem({ tokens: { value, separator } });
      }

      get type() {
        return "enum-value";
      }
      get value() {
        return this.tokens.value.value.slice(1, -1);
      }
      get trivia() {
        return this.tokens.value.trivia;
      }
      get separator() {
        return untype_token(this.tokens.separator);
      }
    }

    class Typedef extends Definition {
      static parse() {
        const tokens = {};
        const ret = new Typedef({ tokens });
        tokens.base = consume("typedef");
        if (!tokens.base) {
          return;
        }
        ret.idlType = type_with_extended_attributes("typedef-type") || error("No type in typedef");
        tokens.name = consume(ID) || error("No name in typedef");
        current = ret;
        tokens.termination = consume(";") || error("Unterminated typedef");
        return ret;
      }

      get type() {
        return "typedef";
      }
      get name() {
        return unescape(this.escapedName);
      }
      get escapedName() {
        return this.tokens.name.value;
      }
    }

    class Includes extends Definition {
      static parse() {
        const target = consume(ID);
        if (!target) {
          return;
        }
        const tokens = { target };
        tokens.includes = consume("includes");
        if (!tokens.includes) {
          unconsume(target.index);
          return;
        }
        tokens.mixin = consume(ID) || error("Incomplete includes statement");
        tokens.termination = consume(";") || error("No terminating ; for includes statement");
        return new Includes({ tokens });
      }

      get type() {
        return "includes";
      }
      get target() {
        return unescape(this.escapedTarget);
      }
      get escapedTarget() {
        return this.tokens.target.value;
      }
      get includes() {
        return unescape(this.escapedIncludes);
      }
      get escapedIncludes() {
        return this.tokens.mixin.value;
      }
    }

    function definition() {
      return callback() ||
        interface_() ||
        partial() ||
        Dictionary.parse() ||
        Enum.parse() ||
        Typedef.parse() ||
        Includes.parse() ||
        Namespace.parse();
    }

    function definitions() {
      if (!source.length) return [];
      const defs = [];
      while (true) {
        const ea = ExtendedAttributes.parse();
        const def = definition();
        if (!def) {
          if (ea) error("Stray extended attributes");
          break;
        }
        def.extAttrs = ea;
        defs.push(def);
      }
      defs.push(consume("eof"));
      return defs;
    }
    const res = definitions();
    if (consume_position < source.length) error("Unrecognised tokens");
    return res;
  }

  const obj = {
    parse(str) {
      const tokens = tokenise(str);
      return parse(tokens);
    }
  };

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = obj;
  } else if (typeof define === 'function' && define.amd) {
    define([], () => obj);
  } else {
    (self || window).WebIDL2 = obj;
  }
})();
