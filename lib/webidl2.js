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
    let lastIndex = 0;
    let trivia = "";
    let line = 1;
    while (lastIndex < str.length) {
      const nextChar = str.charAt(lastIndex);
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
        if (str.startsWith(punctuation, lastIndex)) {
          tokens.push({ type: punctuation, value: punctuation, trivia, line });
          trivia = "";
          lastIndex += punctuation.length;
          result = lastIndex;
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
      lastIndex = result;
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
      re.lastIndex = lastIndex;
      const result = re.exec(str);
      if (result) {
        tokens.push({ type, value: result[0], trivia, line });
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

  function parse(tokens) {
    tokens = tokens.slice();
    const names = new Map();
    let current = null;

    const FLOAT = "float";
    const INT = "integer";
    const ID = "identifier";
    const STR = "string";

    const EMPTY_IDLTYPE = Object.freeze({
      generic: null,
      nullable: null,
      union: false,
      idlType: null,
      baseName: null,
      escapedBaseName: null,
      prefix: null,
      postfix: null,
      separator: null,
      extAttrs: null
    });

    function error(str) {
      const maxTokens = 5;
      const line =
        !probe("eof") ? tokens[consume_position].line :
        tokens.length > 1 ? tokens[consume_position - 1].line :
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
          tokens.slice(consume_position, consume_position + count) :
          tokens.slice(Math.max(consume_position + count, 0), consume_position);
      }

      function tokensToText(inputs, { precedes } = {}) {
        const text = inputs.map(t => t.trivia + t.value).join("");
        const nextToken = tokens[consume_position];
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

    function sanitize_name(name, type) {
      const unescaped = unescape(name);
      if (names.has(unescaped)) {
        error(`The name "${unescaped}" of type "${names.get(unescaped)}" was already seen`);
      }
      names.set(unescaped, type);
      return unescaped;
    }

    let consume_position = 0;

    function probe(type) {
      return tokens.length > consume_position && tokens[consume_position].type === type;
    }

    function consume(...candidates) {
      // TODO: use const when Servo updates its JS engine
      // eslint-disable-next-line prefer-const
      for (let type of candidates) {
        if (!probe(type)) continue;
        const token = tokens[consume_position];
        consume_position++;
        return token;
      }
    }

    /** Use when the target token is intended to be exposed via API */
    function untyped_consume(...args) {
      return untype_token(consume(...args));
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
        Object.defineProperty(this, "tokens", { value: tokens });
      }

      get trivia() {
        const object = {};
        for (const [key, value] of Object.entries(this.tokens)) {
          if (value) {
            object[key] = value.trivia;
          }
        }
        return object;
      }
    }

    function integer_type() {
      const prefix = untyped_consume("unsigned") || null;
      const base = untyped_consume("short", "long");
      if (base) {
        const postfix = untyped_consume("long") || null;
        return {
          idlType: [prefix, base, postfix].filter(t => t).map(t => t.value).join(' '),
          prefix,
          postfix,
          baseName: base.value,
          escapedBaseName: base.value,
          trivia: { base: base.trivia }
        };
      }
      if (prefix) error("Failed to parse integer type");
    }

    function float_type() {
      const prefix = untyped_consume("unrestricted") || null;
      const base = untyped_consume("float", "double");
      if (base) {
        return {
          idlType: [prefix, base].filter(t => t).map(t => t.value).join(' '),
          prefix,
          baseName: base.value,
          escapedBaseName: base.value,
          trivia: { base: base.trivia }
        };
      }
      if (prefix) error("Failed to parse float type");
    }

    function primitive_type() {
      const num_type = integer_type() || float_type();
      if (num_type) return num_type;
      const base = consume("boolean", "byte", "octet");
      if (base) {
        return {
          idlType: base.value,
          baseName: base.value,
          escapedBaseName: base.value,
          trivia: { base: base.trivia }
        };
      }
    }

    function const_value() {
      const token = consume("true", "false", "null", "Infinity", "-Infinity", "NaN", FLOAT, INT);
      if (!token) {
        return;
      }
      const { trivia } = token;
      let data;
      switch (token.type) {
        case "true":
        case "false":
          data = { type: "boolean", value: token.type === "true" };
          break;
        case "Infinity":
        case "-Infinity":
          data = { type: "Infinity", negative: token.type.startsWith("-") };
          break;
        case FLOAT:
        case INT:
          data = { type: "number", value: token.value };
          break;
        default:
          data = { type: token.type };
      }
      return { data, trivia };
    }

    function type_suffix(obj) {
      const nullable = consume("?");
      if (nullable) {
        obj.nullable = { trivia: nullable.trivia };
      }
      if (probe("?")) error("Can't nullable more than once");
    }

    function generic_type(typeName) {
      const name = consume("FrozenArray", "Promise", "sequence", "record");
      if (!name) {
        return;
      }
      const ret = {
        baseName: name.value,
        escapedBaseName: name.value,
        generic: { value: name.value, trivia: {} },
        trivia: { base: name.trivia }
      };
      const open = consume("<") || error(`No opening bracket after ${name.type}`);
      ret.generic.trivia.open = open.trivia;
      switch (name.type) {
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
          ret.idlType = [];
          const keyType = consume(...stringTypes);
          if (!keyType) error(`Record key must be a string type`);
          const separator = untyped_consume(",") || error("Missing comma after record key type");
          ret.idlType.push(Object.assign({ type: typeName }, EMPTY_IDLTYPE, {
            baseName: keyType.value,
            escapedBaseName: keyType.value,
            idlType: keyType.value,
            separator,
            trivia: {
              base: keyType.trivia
            }
          }));
          const valueType = type_with_extended_attributes(typeName) || error("Error parsing generic type record");
          ret.idlType.push(valueType);
          break;
        }
      }
      if (!ret.idlType) error(`Error parsing generic type ${name.type}`);
      const close = consume(">") || error(`Missing closing bracket after ${name.type}`);
      ret.generic.trivia.close = close.trivia;
      return ret;
    }

    function single_type(typeName) {
      const ret = Object.assign({ type: typeName || null }, EMPTY_IDLTYPE, { trivia: {} });
      const base = generic_type(typeName) || primitive_type();
      if (base) {
        Object.assign(ret, base);
      } else {
        const name = consume(ID, ...stringTypes);
        if (!name) {
          return;
        }
        ret.baseName = ret.idlType = unescape(name.value);
        ret.escapedBaseName = name.value;
        ret.trivia.base = name.trivia;
        if (probe("<")) error(`Unsupported generic type ${name.value}`);
      }
      if (ret.generic && ret.generic.value === "Promise" && probe("?")) {
        error("Promise type cannot be nullable");
      }
      type_suffix(ret);
      if (ret.nullable && ret.idlType === "any") error("Type `any` cannot be made nullable");
      return ret;
    }

    function union_type(typeName) {
      const open = consume("(");
      if (!open) return;
      const trivia = { open: open.trivia };
      const ret = Object.assign({ type: typeName || null }, EMPTY_IDLTYPE, { union: true, idlType: [], trivia });
      while (true) {
        const typ = type_with_extended_attributes() || error("No type after open parenthesis or 'or' in union type");
        if (typ.idlType === "any") error("Type `any` cannot be included in a union type");
        ret.idlType.push(typ);
        const or = untyped_consume("or");
        if (or) {
          typ.separator = or;
        }
        else break;
      }
      if (ret.idlType.length < 2) {
        error("At least two types are expected in a union type but found less");
      }
      const close = consume(")") || error("Unterminated union type");
      trivia.close = close.trivia;
      type_suffix(ret);
      return ret;
    }

    function type(typeName) {
      return single_type(typeName) || union_type(typeName);
    }

    function type_with_extended_attributes(typeName) {
      const extAttrs = extended_attrs();
      const ret = single_type(typeName) || union_type(typeName);
      if (ret) ret.extAttrs = extAttrs;
      return ret;
    }

    class Argument extends Definition {
      static parse() {
        const start_position = consume_position;
        const tokens = {};
        const ret = new Argument({ tokens });
        tokens.optional = consume("optional");
        ret.idlType = type_with_extended_attributes("argument-type");
        if (!ret.idlType) {
          return unconsume(start_position);
        }
        if (!tokens.optional) {
          tokens.variadic = consume("...");
        }
        tokens.name = consume(ID, ...argumentNameKeywords);
        if (!tokens.name) {
          return unconsume(start_position);
        }
        if (tokens.optional) {
          ret.default = Default.parse() || null;
        }
        tokens.separator = consume(",");
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
      get trivia() {
        return { name: this.tokens.name.trivia };
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
        const separator = consume(",");
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
        tokens.assign = consume("=");
        if (tokens.assign) {
          tokens.secondaryName = consume(ID, FLOAT, INT, STR);
        }
        tokens.open = consume("(");
        if (tokens.open) {
          args.list = (tokens.assign && !tokens.secondaryName) ?
            // [Exposed=(Window,Worker)]
            identifiers() :
            // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
            argument_list();
          tokens.close = consume(")") || error("Unexpected token in extended attribute argument list");
        }
        const ret = new SimpleExtendedAttribute(args);
        if (tokens.assign && !ret.rhs) error("No right hand side to extended attribute assignment");
        tokens.separator = consume(",");
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
        if (!this.tokens.assign) {
          return null;
        }
        const trivia = { assign: assign.trivia };
        if (secondaryName) {
          return Object.assign({},
            secondaryName, {
              trivia: Object.assign(trivia, {
                value: secondaryName.trivia
              }),
              line: undefined
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
      get trivia() {
        return { name: this.tokens.name.trivia };
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
    function extended_attrs() {
      const open = consume("[");
      if (!open) return null;
      const items = list({ 
        parser: SimpleExtendedAttribute.parse,
        required: true,
        listName: "extended attribute"
      });
      const eas = {
        trivia: { open: open.trivia },
        items
      };
      const close = consume("]") || error("No end of extended attribute");
      eas.trivia.close = close.trivia;
      return eas;
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
        Object.defineProperty(this, "expression", { value: expression });
      }

      get type() {
        const { type, data } = this.expression[0];
        switch (type) {
          case "[":
            return "sequence";
          case STR:
            return type;
          default:
            return data.type;
        }
      }
      get value() {
        const [first] = this.expression;
        switch (first.type) {
          case "[":
            return [];
          case STR:
            return first.value.slice(1, -1);
          default:
            return first.data.value;
        }
      }
      get negative() {
        const [first] = this.expression;
        switch (first.type) {
          case INT:
          case FLOAT:
            return first.value < 0;
          case "Infinity":
            return false;
          case "-Infinity":
            return true;
          default:
            return undefined;
        }
      }
      get trivia() {
        const base = { assign: this.tokens.assign.trivia };
        const [first, second] = this.expression;
        switch (first.type) {
          case "[":
            return Object.assign(base, {
              open: first.trivia,
              close: second.trivia
            });
          default:
            return Object.assign(base, {
              value: first.trivia
            });
        }
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
        let typ = primitive_type();
        if (!typ) {
          typ = consume(ID) || error("No type for const");
          typ = {
            idlType: typ.value,
            baseName: typ.value,
            escapedBaseName: typ.value,
            trivia: { base: typ.trivia }
          };
        }
        const idlType = Object.assign({ type: "const-type" }, EMPTY_IDLTYPE, typ);
        type_suffix(idlType);
        tokens.name = consume(ID) || error("No name for const");
        tokens.assign = consume("=") || error("No value assignment for const");
        const primitive = const_value() || error("No value for const");
        tokens.termination = consume(";") || error("Unterminated const");
        const ret = new Constant({ tokens, primitive });
        ret.idlType = idlType;
        return ret;
      }

      constructor({ tokens, primitive }) {
        super({ tokens });
        Object.defineProperty(this, "primitive", { value: primitive });
      }

      get type() {
        return "const";
      }
      get name() {
        return unescape(this.tokens.name.value);
      }
      get value() {
        return this.primitive.data;
      }
      get trivia() {
        const { base, name, assign, termination } = super.trivia;
        const value = this.primitive.trivia;
        return { base, name, assign, value, termination };
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

      toJSON() {
        return {
          name: this.name,
          escapedName: this.escapedName,
          trivia: this.trivia
        };
      }
    }

    class CallbackFunction extends Definition {
      static parse(base) {
        const tokens = { base };
        const ret = new CallbackFunction({ tokens });
        tokens.name = consume(ID) || error("No name for callback");
        current = ret;
        sanitize_name(ret.name, "callback");
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
          tokens.special = consume("inherit");
        }
        tokens.readonly = consume("readonly");
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
      get trivia() {
        const { base, name, termination } = super.trivia;
        return { base, name, termination };
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
        return Object.assign({ type: "return-type" }, EMPTY_IDLTYPE, {
          idlType: "void",
          baseName: "void",
          escapedBaseName: "void",
          trivia: { base: voidToken.trivia }
        });
      }
    }

    class OperationBody extends Definition {
      static parse() {
        const tokens = {};
        const ret = new OperationBody({ tokens });
        ret.idlType = return_type() || error("Missing return type");
        tokens.name = consume(ID);
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
      get trivia() {
        const { open, close } = super.trivia;
        return { open, close };
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
          tokens.special = consume("getter", "setter", "deleter");
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
      get trivia() {
        const { termination } = super.trivia;
        return { termination };
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
      const special = consume("static");
      if (!special) return;
      const member = Attribute.parse({ special }) ||
        Operation.parse({ special }) ||
        error("No body in static member");
      return member;
    }

    function stringifier() {
      const special = consume("stringifier");
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
        tokens.readonly = consume("readonly");
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
          first.separator = untyped_consume(",") || null;
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
      get trivia() {
        const ret = super.trivia;
        delete ret.readonly;
        return ret;
      }

      toJSON() {
        return {
          type: this.type,
          idlType: this.idlType,
          readonly: this.readonly,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    class Container extends Definition {
      static parse(instance, { type, inheritable, unique, allowedMembers }) {
        const { tokens } = instance;
        tokens.name = consume(ID) || error("No name for interface");
        current = instance;
        if (unique) {
          sanitize_name(instance.name, type);
        }
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
          const ea = extended_attrs();
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
      get trivia() {
        const ret = super.trivia;
        delete ret.partial;
        return ret;
      }

      toJSON() {
        return {
          type: this.type,
          name: this.name,
          escapedName: this.escapedName,
          partial: this.partial,
          members: this.members,
          trivia: this.trivia,
          inheritance: this.inheritance,
          extAttrs: this.extAttrs
        };
      }
    }

    class Interface extends Container {
      static parse(base, { callback = null, partial = null } = {}) {
        const tokens = { callback, partial, base };
        return Container.parse(new Interface({ tokens }), {
          type: "interface",
          inheritable: !partial,
          unique: !partial,
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
      get trivia() {
        const ret = super.trivia;
        const { callback } = this.tokens;
        if (callback) {
          ret.callback = callback.trivia;
        }
        return ret;
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
          unique: !partial,
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
      get trivia() {
        return Object.assign({
          base: null,
          mixin: this.tokens.mixin.trivia
        }, super.trivia);
      }
    }

    function interface_(opts) {
      const base = consume("interface");
      if (!base) return;
      const ret = Mixin.parse(base, opts) ||
        Interface.parse(base, opts) ||
        error("Interface has no proper body");
      ret.trivia.base = base.trivia;
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
          unique: !partial,
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
      const partial = consume("partial");
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
          unique: !partial,
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
        ret.extAttrs = extended_attrs();
        tokens.required = consume("required");
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
      get trivia() {
        const { name, termination } = super.trivia;
        return { name, termination };
      }

      toJSON() {
        return {
          type: this.type,
          name: this.name,
          escapedName: this.escapedName,
          required: this.required,
          idlType: this.idlType,
          extAttrs: this.extAttrs,
          default: this.default,
          trivia: this.trivia
        };
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
        current.values = [];
        sanitize_name(current.name, "enum");
        tokens.open = consume("{") || error("Bodyless enum");
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

      toJSON() {
        return {
          type: this.type,
          name: this.name,
          escapedName: this.escapedName,
          values: this.values,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    class EnumItem extends Definition {
      static parse() {
        const value = consume(STR) || error("Unexpected value in enum");
        const separator = consume(",");
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

      toJSON() {
        return {
          type: this.type,
          value: this.value,
          trivia: this.trivia,
          separator: this.separator
        };
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
        sanitize_name(ret.name, "typedef");
        tokens.termination = consume(";") || error("Unterminated typedef");
        return current;
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

      toJSON() {
        return {
          type: this.type,
          idlType: this.idlType,
          name: this.name,
          escapedName: this.escapedName,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    class Includes extends Definition {
      static parse() {
        const start_position = consume_position;
        const tokens = {};
        tokens.target = consume(ID);
        if (!tokens.target) {
          return;
        }
        tokens.includes = consume("includes");
        if (!tokens.includes) {
          unconsume(start_position);
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

      toJSON() {
        return {
          type: this.type,
          target: this.target,
          escapedTarget: this.escapedTarget,
          includes: this.includes,
          escapedIncludes: this.escapedIncludes,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
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
      if (!tokens.length) return [];
      const defs = [];
      while (true) {
        const ea = extended_attrs();
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
    if (consume_position < tokens.length) error("Unrecognised tokens");
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
