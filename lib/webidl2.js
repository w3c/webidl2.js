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

    function tryParse(constructor, ...args) {
      try {
        return new constructor(...args);
      } catch (e) {
        if (!e.message.startsWith("Failed to parse")) {
          throw e;
        }
      }
    }

    /**
     * @param {number?} previousPosition
     */
    function halt(previousPosition) {
      if (previousPosition !== undefined) {
        consume_position = previousPosition;
      }
      throw new Error("Failed to parse but possibly can be parsed as another syntax element");
    }

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
      while (consume_position > position) {
        consume_position--;
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

    class Identifier {
      constructor() {
        const value = consume(ID) || error("Expected identifiers but none found");
        const separator = consume(",");
        Object.defineProperty(this, "tokens", {
          value: { value, separator }
        });
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
      const id = new Identifier();
      arr.push(id);
      while (id.separator) {
        const id = new Identifier();
        arr.push(id);
        if (!id.separator) break;
      }
      return arr;
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

    function inheritance() {
      const colon = consume(":");
      if (colon) {
        const inh = consume(ID) || error("No type in inheritance");
        return {
          name: unescape(inh.value),
          escapedName: inh.value,
          trivia: { colon: colon.trivia, name: inh.trivia }
        };
      }
    }

    function callback() {
      const callbackToken = consume("callback");
      if (!callbackToken) return;
      const tok = consume("interface");
      if (tok) {
        return new Interface(tok, { typeName: "callback interface", callback: callbackToken });
      }
      const trivia = { base: callbackToken.trivia };
      const name = consume(ID) || error("No name for callback");
      trivia.name = name.trivia;
      const ret = current = { type: "callback", name: sanitize_name(name.value, "callback") };
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

    class Attribute {
      constructor({ special, noInherit = false, readonly = false } = {}) {
        const start_position = consume_position;
        Object.defineProperty(this, "tokens", {
          value: { special }
        });
        if (!special && !noInherit) {
          this.tokens.special = consume("inherit");
        }
        this.tokens.readonly = consume("readonly");
        if (readonly && !this.tokens.readonly && probe("attribute")) {
          error("Attributes must be readonly in this context");
        }
        this.tokens.base = consume("attribute");
        if (!this.tokens.base) {
          return halt(start_position);
        }
        this.idlType = type_with_extended_attributes("attribute-type") || error("No type in attribute");
        switch (this.idlType.generic && this.idlType.generic.value) {
          case "sequence":
          case "record": error(`Attributes cannot accept ${this.idlType.generic.value} types`);
        }
        this.tokens.name = consume(ID, "required") || error("No name in attribute");
        this.tokens.termination = consume(";") || error("Unterminated attribute");
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
        return {
          base: this.tokens.base.trivia,
          name: this.tokens.name.trivia,
          termination: this.tokens.termination.trivia
        };
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

    class OperationBody {
      constructor() {
        this.idlType = return_type() || error("Missing return type");
        const name = consume(ID);
        const open = consume("(") || error("Invalid operation");
        this.arguments = argument_list();
        const close = consume(")") || error("Unterminated operation");
        Object.defineProperty(this, "tokens", {
          value: {
            name,
            open,
            close
          }
        });
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
        return {
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia
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

    class Operation {
      constructor({ special, regular } = {}) {
        Object.defineProperty(this, "tokens", {
          value: { special }
        });
        if (special && special.value === "stringifier") {
          const termination = consume(";");
          if (termination) {
            this.tokens.termination = termination;
            this.body = null;
            return;
          }
        }
        if (!special && !regular) {
          this.tokens.special = consume("getter", "setter", "deleter");
        }
        this.body = new OperationBody();
        this.tokens.termination = consume(";") || error("Unterminated attribute");
      }

      get type() {
        return "operation";
      }
      get special() {
        return untype_token(this.tokens.special);
      }
      get trivia() {
        return {
          termination: this.tokens.termination.trivia
        };
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
      const member = tryParse(Attribute, { special }) ||
        tryParse(Operation, { special }) ||
        error("No body in static member");
      return member;
    }

    function stringifier() {
      const special = consume("stringifier");
      if (!special) return;
      const member = tryParse(Attribute, { special }) ||
        tryParse(Operation, { special }) ||
        error("Unterminated stringifier");
      return member;
    }

    class IterableLike {
      constructor() {
        const start_position = consume_position;
        const readonly = consume("readonly");

        const base = readonly ?
          consume("maplike", "setlike") :
          consume("iterable", "maplike", "setlike");
        if (!base) {
          return halt(start_position);
        }

        const secondTypeRequired = base.value === "maplike";
        const secondTypeAllowed = secondTypeRequired || base.value === "iterable";

        const open = consume("<") || error(`Error parsing ${base.value} declaration`);
        const first = type_with_extended_attributes() || error(`Error parsing ${base.value} declaration`);
        this.idlType = [first];
        if (secondTypeAllowed) {
          first.separator = untyped_consume(",") || null;
          if (first.separator) {
            this.idlType.push(type_with_extended_attributes());
          }
          else if (secondTypeRequired)
            error(`Missing second type argument in ${base.value} declaration`);
        }
        const close = consume(">") || error(`Unterminated ${base.value} declaration`);
        const termination = consume(";") || error(`Missing semicolon after ${base.value} declaration`);

        Object.defineProperty(this, "tokens", {
          value: {
            readonly,
            base,
            open,
            close,
            termination
          }
        });
      }

      get type() {
        return this.tokens.base.value;
      }
      get readonly() {
        return unvalue_token(this.tokens.readonly);
      }
      get trivia() {
        return {
          base: this.tokens.base.trivia,
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia,
          termination: this.tokens.termination.trivia
        };
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

    class Interface {
      constructor(base, { callback = null, partial = null } = {}) {
        const name = consume(ID) || error("No name for interface");
        Object.defineProperty(this, "tokens", {
          value: { callback, partial, base, name }
        });
        current = this;
        if (!partial) {
          sanitize_name(name.value, "interface");
          this.inheritance = inheritance() || null;
        }
        this.tokens.open = consume("{") || error("Bodyless interface");
        this.members = [];
        while (true) {
          this.tokens.close = consume("}");
          if (this.tokens.close) {
            this.tokens.termination = consume(";") || error("Missing semicolon after interface");
            return;
          }
          const ea = extended_attrs();
          const mem = const_() ||
            static_member() ||
            stringifier() ||
            tryParse(IterableLike) ||
            tryParse(Attribute) ||
            tryParse(Operation) ||
            error("Unknown member");
          mem.extAttrs = ea;
          this.members.push(mem);
        }
      }

      get type() {
        if (this.tokens.callback) {
          return "callback interface";
        }
        return "interface";
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
        const ret = {
          base: this.tokens.base.trivia,
          name: this.tokens.name.trivia,
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia,
          termination: this.tokens.termination.trivia
        };
        const { callback } = this.tokens;
        if (callback) {
          ret.callback = callback.trivia;
        }
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

    class Mixin {
      constructor(base, { partial = null } = {}) {
        const mixin = consume("mixin");
        if (!mixin) {
          return halt();
        }
        const name = consume(ID) || error("No name for interface mixin");
        Object.defineProperty(this, "tokens", {
          value: { partial, base, mixin, name }
        });
        current = this;
        if (!partial) {
          sanitize_name(name.value, "interface mixin");
        }
        this.members = [];
        this.tokens.open = consume("{") || error("Bodyless interface mixin");
        while (true) {
          this.tokens.close = consume("}");
          if (this.tokens.close) {
            this.tokens.termination = consume(";") || error("Missing semicolon after interface mixin");
            return;
          }
          const ea = extended_attrs();
          const mem = const_() ||
            stringifier() ||
            tryParse(Attribute, { noInherit: true }) ||
            tryParse(Operation, { regular: true }) ||
            error("Unknown member");
          mem.extAttrs = ea;
          this.members.push(mem);
        }
      }

      get type() {
        return "interface mixin";
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
        return {
          base: this.tokens.base.trivia,
          mixin: this.tokens.mixin.trivia,
          name: this.tokens.name.trivia,
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia,
          termination: this.tokens.termination.trivia
        };
      }

      toJSON() {
        return {
          type: this.type,
          name: this.name,
          escapedName: this.escapedName,
          partial: this.partial,
          members: this.members,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    function interface_(opts) {
      const base = consume("interface");
      if (!base) return;
      const ret = tryParse(Mixin, base, opts) ||
        tryParse(Interface, base, opts) ||
        error("Interface has no proper body");
      ret.trivia.base = base.trivia;
      return ret;
    }

    class Namespace {
      constructor({ partial = null } = {}) {
        const base = consume("namespace");
        if (!base) {
          return halt();
        }
        const name = consume(ID) || error("No name for namespace");
        Object.defineProperty(this, "tokens", {
          value: { partial, base, name }
        });
        current = this;
        if (!partial) {
          sanitize_name(name.value, "namespace");
        }
        this.members = [];
        this.tokens.open = consume("{") || error("Bodyless namespace");
        while (true) {
          this.tokens.close = consume("}");
          if (this.tokens.close) {
            this.tokens.termination = consume(";") || error("Missing semicolon after namespace");
            return;
          }
          const ea = extended_attrs();
          const mem = tryParse(Attribute, { noInherit: true, readonly: true }) ||
            tryParse(Operation, { regular: true }) ||
            error("Unknown member");
          mem.extAttrs = ea;
          this.members.push(mem);
        }
      }

      get type() {
        return "namespace";
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
        return {
          base: this.tokens.base.trivia,
          name: this.tokens.name.trivia,
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia,
          termination: this.tokens.termination.trivia
        };
      }

      toJSON() {
        return {
          type: this.type,
          name: this.name,
          escapedName: this.escapedName,
          partial: this.partial,
          members: this.members,
          trivia: this.trivia,
          extAttrs: this.extAttrs
        };
      }
    }

    function partial() {
      const partial = consume("partial");
      if (!partial) return;
      return tryParse(Dictionary, { partial }) ||
        interface_({ partial }) ||
        tryParse(Namespace, { partial }) ||
        error("Partial doesn't apply to anything");
    }

    class Dictionary {
      constructor({ partial } = {}) {
        const base = consume("dictionary");
        if (!base) {
          return halt();
        }
        const name = consume(ID) || error("No name for dictionary");
        Object.defineProperty(this, "tokens", {
          value: { partial, base, name }
        });
        current = this;
        if (!partial) {
          sanitize_name(name.value, "dictionary");
          this.inheritance = inheritance() || null;
        }
        this.tokens.open = consume("{") || error("Bodyless dictionary");
        this.members = [];
        while (true) {
          this.tokens.close = consume("}");
          if (this.tokens.close) {
            this.tokens.termination = consume(";") || error("Missing semicolon after dictionary");
            return;
          }
          this.members.push(new Field());
        }
      }

      get type() {
        return "dictionary";
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
        return {
          base: this.tokens.base.trivia,
          name: this.tokens.name.trivia,
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia,
          termination: this.tokens.termination.trivia
        };
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

    class Field {
      constructor() {
        this.extAttrs = extended_attrs();
        const required = consume("required");
        this.idlType = type_with_extended_attributes("dictionary-type") || error("No type for dictionary member");
        const name = consume(ID) || error("No name for dictionary member");
        this.default = default_() || null;
        if (required && this.default) error("Required member must not have a default");
        const termination = consume(";") || error("Unterminated dictionary member");
        Object.defineProperty(this, "tokens", {
          value: {
            required,
            name,
            termination
          }
        });
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
        return {
          name: this.tokens.name.trivia,
          termination: this.tokens.termination.trivia
        };
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

    class Enum {
      constructor() {
        const base = consume("enum");
        if (!base) {
          return halt();
        }
        const name = consume(ID) || error("No name for enum");
        Object.defineProperty(this, "tokens", {
          value: { base, name }
        });
        current = this;
        sanitize_name(name.value, "enum");
        this.tokens.open = consume("{") || error("Bodyless enum");
        this.values = [];
        let value_expected = true;
        while (true) {
          this.tokens.close = consume("}");
          if (this.tokens.close) {
            if (!this.values.length) error("No value in enum");
            this.tokens.termination = consume(";") || error("No semicolon after enum");
            return;
          }
          else if (!value_expected) {
            error("No comma between enum values");
          }
          const item = new EnumItem();
          this.values.push(item);
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
      get trivia() {
        return {
          base: this.tokens.base.trivia,
          name: this.tokens.name.trivia,
          open: this.tokens.open.trivia,
          close: this.tokens.close.trivia,
          termination: this.tokens.termination.trivia
        };
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

    class EnumItem {
      constructor() {
        const value = consume(STR) || error("Unexpected value in enum");
        const separator = consume(",");
        Object.defineProperty(this, "tokens", {
          value: { value, separator }
        });
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

    class Typedef {
      constructor() {
        const base = consume("typedef");
        if (!base) {
          return halt();
        }
        this.idlType = type_with_extended_attributes("typedef-type") || error("No type in typedef");
        const name = consume(ID) || error("No name in typedef");
        sanitize_name(name.value, "typedef");
        current = this;
        const termination = consume(";") || error("Unterminated typedef");
        Object.defineProperty(this, "tokens", {
          value: {
            base,
            name,
            termination
          }
        });
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
      get trivia() {
        return {
          base: this.tokens.base.trivia,
          name: this.tokens.name.trivia,
          termination: this.tokens.termination.trivia
        };
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

    class Includes {
      constructor() {
        const start_position = consume_position;
        const target = consume(ID);
        if (!target) {
          return halt(start_position);
        }
        const includes = consume("includes");
        if (!includes) {
          return halt(start_position);
        }
        const mixin = consume(ID) || error("Incomplete includes statement");
        const termination = consume(";") || error("No terminating ; for includes statement");
        Object.defineProperty(this, "tokens", {
          value: {
            target,
            includes,
            mixin,
            termination
          }
        });
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
      get trivia() {
        return {
          target: this.tokens.target.trivia,
          includes: this.tokens.includes.trivia,
          mixin: this.tokens.mixin.trivia,
          termination: this.tokens.termination.trivia
        };
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
        tryParse(Dictionary) ||
        tryParse(Enum) ||
        tryParse(Typedef) ||
        tryParse(Includes) ||
        tryParse(Namespace);
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
