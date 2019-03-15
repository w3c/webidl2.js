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

    /** Use when the target token is intended to be exposed via API */
    function untyped_consume(...args) {
      const token = consume(...args);
      if (token) {
        const { value, trivia } = token;
        return { value, trivia };
      }
    }

    function unescape(identifier) {
      return identifier.startsWith('_') ? identifier.slice(1) : identifier;
    }

    function unconsume(position) {
      while (consume_position > position) {
        consume_position--;
      }
    }

    /**
     * Parses comma-separated list
     * @param {object} args
     * @param {Function} args.parser parser function for each item
     * @param {boolean} [args.allowDangler] whether to allow dangling comma
     * @param {string} [args.listName] the name to be shown on error messages
     */
    function list({ parser, allowDangler, listName = "list" }) {
      const first = parser();
      if (!first) {
        return [];
      }
      first.tokens.separator = optional_consume(",");
      const items = [first];
      while (first.tokens.separator) {
        const item = parser();
        if (!item) {
          if (!allowDangler) {
            error(`Trailing comma in ${listName}`);
          }
          break;
        }
        item.tokens.separator = optional_consume(",");
        items.push(item);
        if (!item.tokens.separator) break;
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
      return consume("true", "false", "Infinity", "-Infinity", "NaN", FLOAT, INT);
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
        case "Promise": {
          if (probe("[")) error("Promise type cannot have extended attribute");
          const subtype = return_type(typeName) || error("Missing Promise subtype");
          ret.idlType = [subtype];
          break;
        }
        case "sequence":
        case "FrozenArray": {
          const subtype = type_with_extended_attributes(typeName) || error(`Missing ${name.type} subtype`);
          ret.idlType = [subtype];
          break;
        }
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
        ret.default = tokens.optional ? Default.parse() : null;
        return ret;
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
    }

    function argument_list() {
      return list({ parser: Argument.parse, listName: "arguments list" });
    }

    class Token extends Definition {
      /**
       * @param {string} type
       */
      static parser(type) {
        return () => {
          const value = consume(type);
          if (value) {
            return new Token({ tokens: { value } });
          }
        };
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
    }

    function identifiers() {
      const ids = list({ parser: Token.parser(ID), listName: "identifier list" });
      if (!ids.length) {
        error("Expected identifiers but none found");
      }
      return ids;
    }

    class ExtendedAttributeParameters extends Definition {
      static parse() {
        const tokens = { assign: consume("=") };
        const ret = new ExtendedAttributeParameters({ tokens });
        if (tokens.assign) {
          tokens.secondaryName = optional_consume(ID, FLOAT, INT, STR);
        }
        tokens.open = consume("(");
        if (tokens.open) {
          ret.list = ret.rhsType === "identifier-list" ?
            // [Exposed=(Window,Worker)]
            identifiers() :
            // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
            argument_list();
          tokens.close = consume(")") || error("Unexpected token in extended attribute argument list");
        } else if (ret.hasRhs && !tokens.secondaryName) {
          error("No right hand side to extended attribute assignment");
        }
        return ret;
      }

      get rhsType() {
        return !this.tokens.assign ? null :
          !this.tokens.secondaryName ? "identifier-list" :
          this.tokens.secondaryName.type;
      }
    }

    class SimpleExtendedAttribute extends Definition {
      static parse() {
        const name = consume(ID);
        if (name) {
          return new SimpleExtendedAttribute({
            tokens: { name },
            params: ExtendedAttributeParameters.parse()
          });
        }
      }

      constructor({ tokens, params }) {
        super({ tokens });
        Object.defineProperty(this, "params", { value: params });
      }

      get type() {
        return "extended-attribute";
      }
      get name() {
        return this.tokens.name.value;
      }
      get rhs() {
        const { rhsType: type, tokens, list, trivia } = this.params;
        if (!type) {
          return null;
        }
        const value = type === "identifier-list" ? list : tokens.secondaryName.value;
        if (!Array.isArray(value)) {
          trivia.value = tokens.secondaryName.trivia;
          trivia.open = trivia.close = undefined;
        }
        return { type, value, trivia };
      }
      get signature() {
        const { rhsType, list, trivia } = this.params;
        if (!list || rhsType === "identifier-list") {
          return null;
        }
        trivia.assign = undefined;
        return { arguments: list, trivia };
      }
      get separator() {
        return untype_token(this.tokens.separator);
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
          listName: "extended attribute"
        });
        tokens.close = consume("]") || error("Unexpected form of extended attribute");
        if (!ret.items.length) {
          error("Found an empty extended attribute");
        }
        return ret;
      }
    }

    class Default extends Definition {
      static parse() {
        const assign = consume("=");
        if (!assign) {
          return null;
        }
        const def = const_value() || consume(STR, "null", "[") || error("No value for default");
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
        return const_data(this.expression[0]).type;
      }
      get value() {
        return const_data(this.expression[0]).value;
      }
      get negative() {
        return const_data(this.expression[0]).negative;
      }
      get trivia() {
        const [first, second] = this.expression;
        const trivia = first.type === "[" ? {
          open: first.trivia,
          close: second.trivia
        } : { value: first.trivia };
        return Object.assign(super.trivia, trivia);
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
          idlType = {
            idlType: base.value,
            baseName: unescape(base.value),
            escapedBaseName: base.value,
            trivia: { base: base.trivia }
          };
        }
        idlType = Object.assign({ type: "const-type" }, EMPTY_IDLTYPE, idlType);
        if (probe("?")) {
          error("Unexpected nullable constant type");
        }
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
    }

    class CallbackFunction extends Definition {
      static parse(base) {
        const tokens = { base };
        const ret = new CallbackFunction({ tokens });
        tokens.name = consume(ID) || error("No name for callback");
        current = ret;
        sanitize_name(ret.name, ret.type);
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
        if (!instance.partial) {
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
        ret.default = Default.parse();
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
        sanitize_name(current.name, "enum");
        tokens.open = consume("{") || error("Bodyless enum");
        current.values = list({
          parser: EnumValue.parse,
          allowDangler: true,
          listName: "enumeration"
        });
        if (probe(STR)) {
          error("No comma between enum values");
        }
        tokens.close = consume("}") || error("Unexpected value in enum");
        if (!current.values.length) {
          error("No value in enum");
        }
        tokens.termination = consume(";") || error("No semicolon after enum");
        return current;
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

    class EnumValue extends Token {
      static parse() {
        const value = consume(STR);
        if (value) {
          return new EnumValue({ tokens: { value } });
        }
      }

      get type() {
        return "enum-value";
      }
      get value() {
        return super.value.slice(1, -1);
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
