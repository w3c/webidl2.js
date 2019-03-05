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

    const EMPTY_OPERATION = Object.freeze({
      type: "operation",
      special: null,
      body: null
    });

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

    function argument() {
      const start_position = consume_position;
      const ret = { optional: null, variadic: null, default: null, trivia: {} };
      const optional = consume("optional");
      if (optional) {
        ret.optional = { trivia: optional.trivia };
      }
      ret.idlType = type_with_extended_attributes("argument-type");
      if (!ret.idlType) {
        unconsume(start_position);
        return;
      }
      if (!ret.optional) {
        const variadic = consume("...");
        if (variadic) {
          ret.variadic = { trivia: variadic.trivia };
        }
      }
      const name = consume(ID, ...argumentNameKeywords);
      if (!name) {
        unconsume(start_position);
        return;
      }
      ret.name = unescape(name.value);
      ret.escapedName = name.value;
      ret.trivia.name = name.trivia;
      if (ret.optional) {
        ret.default = default_() || null;
      }
      return ret;
    }

    function argument_list() {
      const ret = [];
      const arg = argument();
      if (!arg) return ret;
      arg.separator = untyped_consume(",") || null;
      ret.push(arg);
      while (arg.separator) {
        const nxt = argument() || error("Trailing comma in arguments list");
        nxt.separator = untyped_consume(",") || null;
        ret.push(nxt);
        if (!nxt.separator) break;
      }
      return ret;
    }

    function simple_extended_attr() {
      const name = consume(ID);
      if (!name) return;
      const trivia = { name: name.trivia };
      const ret = {
        name: name.value,
        signature: null,
        type: "extended-attribute",
        rhs: null,
        trivia
      };
      const eq = consume("=");
      if (eq) {
        ret.rhs = consume(ID, FLOAT, INT, STR);
        if (ret.rhs) {
          delete ret.rhs.line;
          delete ret.rhs.index;
          ret.rhs.trivia = {
            assign: eq.trivia,
            value: ret.rhs.trivia
          };
        }
      }
      const open = consume("(");
      if (open) {
        const listTrivia = { open: open.trivia };
        if (eq && !ret.rhs) {
          // [Exposed=(Window,Worker)]
          listTrivia.assign = eq.trivia;
          ret.rhs = {
            type: "identifier-list",
            value: identifiers(),
            trivia: listTrivia
          };
        }
        else {
          // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
          ret.signature = {
            arguments: argument_list(),
            trivia: listTrivia
          };
        }
        const close = consume(")") || error("Unexpected token in extended attribute argument list");
        listTrivia.close = close.trivia;
      }
      if (eq && !ret.rhs) error("No right hand side to extended attribute assignment");
      return ret;
    }

    // Note: we parse something simpler than the official syntax. It's all that ever
    // seems to be used
    function extended_attrs() {
      const open = consume("[");
      if (!open) return null;
      const eas = {
        trivia: { open: open.trivia },
        items: []
      };
      const first = simple_extended_attr() || error("Extended attribute with not content");
      first.separator = untyped_consume(",") || null;
      eas.items.push(first);
      while (first.separator) {
        const attr = simple_extended_attr() || error("Trailing comma in extended attribute");
        attr.separator = untyped_consume(",") || null;
        eas.items.push(attr);
        if (!attr.separator) break;
      }
      const close = consume("]") || error("No end of extended attribute");
      eas.trivia.close = close.trivia;
      return eas;
    }

    function default_() {
      const assign = consume("=");
      if (!assign) {
        return;
      }

      const trivia = { assign: assign.trivia };
      const def = const_value();
      if (def) {
        trivia.value = def.trivia;
        return Object.assign(def.data, { trivia });
      }

      const open = consume("[");
      if (open) {
        const close = consume("]");
        if (!close) error("Default sequence value must be empty");
        trivia.open = open.trivia;
        trivia.close = close.trivia;
        return { type: "sequence", value: [], trivia };
      }

      const str = consume(STR) || error("No value for default");
      trivia.value = str.trivia;
      return {
        type: "string",
        value: str.value.slice(1, -1),
        trivia
      };
    }

    function const_() {
      const base = consume("const");
      if (!base) return;
      const trivia = { base: base.trivia };
      const ret = { type: "const" };
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
      ret.idlType = Object.assign({ type: "const-type" }, EMPTY_IDLTYPE, typ);
      type_suffix(ret.idlType);
      const name = consume(ID) || error("No name for const");
      ret.name = name.value;
      trivia.name = name.trivia;
      const assign = consume("=") || error("No value assignment for const");
      trivia.assign = assign.trivia;
      const cnt = const_value() || error("No value for const");
      ret.value = cnt.data;
      trivia.value = cnt.trivia;
      const termination = consume(";") || error("Unterminated const");
      trivia.termination = termination.trivia;
      ret.trivia = trivia;
      return ret;
    }

    function operation_rest(ret) {
      const { body } = ret;
      body.trivia = {};
      const name = consume(ID);
      body.name = name ? {
        value: unescape(name.value),
        escaped: name.value,
        trivia: name.trivia,
      } : null;
      const open = consume("(") || error("Invalid operation");
      body.trivia.open = open.trivia;
      body.arguments = argument_list();
      const close = consume(")") || error("Unterminated operation");
      body.trivia.close = close.trivia;
      const termination = consume(";") || error("Unterminated operation");
      ret.trivia = { termination: termination.trivia };
      return ret;
    }

    function callback() {
      let ret;
      const callbackToken = consume("callback");
      if (!callbackToken) return;
      const tok = consume("interface");
      if (tok) {
        ret = interface_rest({ typeName: "callback interface" });
        ret.trivia.callback = callbackToken.trivia;
        ret.trivia.base = tok.trivia;
        return ret;
      }
      const trivia = { base: callbackToken.trivia };
      const name = consume(ID) || error("No name for callback");
      trivia.name = name.trivia;
      ret = current = { type: "callback", name: sanitize_name(name.value, "callback") };
      const assign = consume("=") || error("No assignment in callback");
      trivia.assign = assign.trivia;
      ret.idlType = return_type() || error("Missing return type");
      const open = consume("(") || error("No arguments in callback");
      trivia.open = open.trivia;
      ret.arguments = argument_list();
      const close = consume(")") || error("Unterminated callback");
      trivia.close = close.trivia;
      const termination = consume(";") || error("Unterminated callback");
      trivia.termination = termination.trivia;
      ret.trivia = trivia;
      return ret;
    }

    function attribute({ noInherit = false, readonly = false } = {}) {
      const start_position = consume_position;
      const ret = {
        type: "attribute",
        special: null,
        readonly: null,
        trivia: {}
      };
      if (!noInherit) {
        ret.special = untyped_consume("inherit") || null;
      }
      const readonlyToken = consume("readonly");
      if (readonlyToken) {
        ret.readonly = { trivia: readonlyToken.trivia };
      } else if (readonly && probe("attribute")) {
        error("Attributes must be readonly in this context");
      }
      const rest = attribute_rest(ret);
      if (!rest) {
        unconsume(start_position);
      }
      return rest;
    }

    function attribute_rest(ret) {
      const base = consume("attribute");
      if (!base) {
        return;
      }
      ret.trivia.base = base.trivia;
      ret.idlType = type_with_extended_attributes("attribute-type") || error("No type in attribute");
      switch (ret.idlType.generic && ret.idlType.generic.value) {
        case "sequence":
        case "record": error(`Attributes cannot accept ${ret.idlType.generic.value} types`);
      }
      const name = consume(ID, "required") || error("No name in attribute");
      ret.name = unescape(name.value);
      ret.escapedName = name.value;
      ret.trivia.name = name.trivia;
      const termination = consume(";") || error("Unterminated attribute");
      ret.trivia.termination = termination.trivia;
      return ret;
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

    function operation({ regular = false } = {}) {
      const ret = Object.assign({}, EMPTY_OPERATION, { body: {} });
      if (!regular) {
        ret.special = untyped_consume("getter", "setter", "deleter") || null;
      }
      ret.body.idlType = return_type() || error("Missing return type");
      operation_rest(ret);
      return ret;
    }

    function static_member() {
      const token = untyped_consume("static");
      if (!token) return;
      const member = attribute({ noInherit: true }) ||
        operation({ regular: true }) ||
        error("No body in static member");
      member.special = token;
      return member;
    }

    function stringifier() {
      const token = untyped_consume("stringifier");
      if (!token) return;
      const termination = consume(";");
      if (termination) {
        return Object.assign({}, EMPTY_OPERATION, {
          special: token,
          trivia: {
            termination: termination.trivia
          }
        });
      }
      const member = attribute({ noInherit: true }) ||
        operation({ regular: true }) ||
        error("Unterminated stringifier");
      member.special = token;
      return member;
    }

    function identifiers() {
      const arr = [];
      const id = untyped_consume(ID) || error("Expected identifiers but none found");
      id.separator = untyped_consume(",") || null;
      arr.push(id);
      while (id.separator) {
        const id = untyped_consume(ID) || error("Trailing comma in identifiers list");
        id.separator = untyped_consume(",") || null;
        arr.push(id);
        if (!id.separator) break;
      }
      return arr;
    }

    function iterable_type() {
      return consume("iterable", "maplike", "setlike");
    }

    function readonly_iterable_type() {
      return consume("maplike", "setlike");
    }

    function iterable() {
      const start_position = consume_position;
      const ret = { type: null, idlType: null, readonly: null, trivia: {} };
      const readonly = consume("readonly");
      if (readonly) {
        ret.readonly = { trivia: readonly.trivia };
      }
      const consumeItType = ret.readonly ? readonly_iterable_type : iterable_type;

      const ittype = consumeItType();
      if (!ittype) {
        unconsume(start_position);
        return;
      }
      ret.trivia.base = ittype.trivia;

      const secondTypeRequired = ittype.value === "maplike";
      const secondTypeAllowed = secondTypeRequired || ittype.value === "iterable";
      ret.type = ittype.value;
      if (ret.type !== 'maplike' && ret.type !== 'setlike')
        delete ret.readonly;
      const open = consume("<") || error(`Error parsing ${ittype.value} declaration`);
      ret.trivia.open = open.trivia;
      const first = type_with_extended_attributes() || error(`Error parsing ${ittype.value} declaration`);
      ret.idlType = [first];
      if (secondTypeAllowed) {
        first.separator = untyped_consume(",") || null;
        if (first.separator) {
          ret.idlType.push(type_with_extended_attributes());
        }
        else if (secondTypeRequired)
          error(`Missing second type argument in ${ittype.value} declaration`);
      }
      const close = consume(">") || error(`Unterminated ${ittype.value} declaration`);
      ret.trivia.close = close.trivia;
      const termination = consume(";") || error(`Missing semicolon after ${ittype.value} declaration`);
      ret.trivia.termination = termination.trivia;

      return ret;
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
    }

    function interface_rest({ typeName = "interface", partialModifier = null } = {}) {
      const name = consume(ID) || error("No name for interface");
      const trivia = {
        base: null,
        name: name.trivia
      };
      const mems = [];
      const ret = current = {
        type: typeName,
        name: partialModifier ? name.value : sanitize_name(name.value, "interface"),
        escapedName: name.value,
        partial: partialModifier,
        members: mems,
        trivia
      };
      if (!partialModifier) ret.inheritance = Inheritance.parse() || null;
      const open = consume("{") || error("Bodyless interface");
      trivia.open = open.trivia;
      while (true) {
        const close = consume("}");
        if (close) {
          trivia.close = close.trivia;
          const termination = consume(";") || error("Missing semicolon after interface");
          trivia.termination = termination.trivia;
          return ret;
        }
        const ea = extended_attrs();
        const mem = const_() ||
          static_member() ||
          stringifier() ||
          iterable() ||
          attribute() ||
          operation() ||
          error("Unknown member");
        mem.extAttrs = ea;
        ret.members.push(mem);
      }
    }

    function mixin_rest({ partialModifier = null } = {}) {
      const mixin = consume("mixin");
      if (!mixin) return;
      const trivia = {
        base: null,
        mixin: mixin.trivia
      };
      const name = consume(ID) || error("No name for interface mixin");
      trivia.name = name.trivia;
      const mems = [];
      const ret = current = {
        type: "interface mixin",
        name: partialModifier ? name.value : sanitize_name(name.value, "interface mixin"),
        escapedName: name.value,
        partial: partialModifier,
        members: mems,
        trivia
      };
      const open = consume("{") || error("Bodyless interface mixin");
      trivia.open = open.trivia;
      while (true) {
        const close = consume("}");
        if (close) {
          trivia.close = close.trivia;
          const termination = consume(";") || error("Missing semicolon after interface mixin");
          trivia.termination = termination.trivia;
          return ret;
        }
        const ea = extended_attrs();
        const mem = const_() ||
          stringifier() ||
          attribute({ noInherit: true }) ||
          operation({ regular: true }) ||
          error("Unknown member");
        mem.extAttrs = ea;
        ret.members.push(mem);
      }
    }

    function interface_(opts) {
      const base = consume("interface");
      if (!base) return;
      const ret = mixin_rest(opts) ||
        interface_rest(opts) ||
        error("Interface has no proper body");
      ret.trivia.base = base.trivia;
      return ret;
    }

    function namespace({ partialModifier = null } = {}) {
      const base = consume("namespace");
      if (!base) return;
      const trivia = { base: base.trivia };
      const name = consume(ID) || error("No name for namespace");
      trivia.name = name.trivia;
      const mems = [];
      const ret = current = {
        type: "namespace",
        name: partialModifier ? name.value : sanitize_name(name.value, "namespace"),
        escapedName: name.value,
        partial: partialModifier,
        members: mems,
        trivia
      };
      const open = consume("{") || error("Bodyless namespace");
      trivia.open = open.trivia;
      while (true) {
        const close = consume("}");
        if (close) {
          trivia.close = close.trivia;
          const termination = consume(";") || error("Missing semicolon after namespace");
          trivia.termination = termination.trivia;
          return ret;
        }
        const ea = extended_attrs();
        const mem = attribute({ noInherit: true, readonly: true }) ||
          operation({ regular: true }) ||
          error("Unknown member");
        mem.extAttrs = ea;
        ret.members.push(mem);
      }
    }

    function partial() {
      const partial = optional_consume("partial");
      if (!partial) return;
      const partialModifier = { trivia: partial.trivia };
      return Dictionary.parse({ partial }) ||
        interface_({ partialModifier }) ||
        namespace({ partialModifier }) ||
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
        ret.extAttrs = extended_attrs();
        tokens.required = optional_consume("required");
        ret.idlType = type_with_extended_attributes("dictionary-type") || error("No type for dictionary member");
        tokens.name = consume(ID) || error("No name for dictionary member");
        ret.default = default_() || null;
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
        namespace();
    }

    function definitions() {
      if (!source.length) return [];
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
