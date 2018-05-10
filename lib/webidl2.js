"use strict";

(() => {
  // These regular expressions use the sticky flag so they will only match at
  // the current location (ie. the offset of lastIndex).
  const tokenRe = {
    // This expression uses a lookahead assertion to catch false matches
    // against integers early.
    "float": /-?(?=[0-9]*\.|[0-9]+[eE])(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/y,
    "integer": /-?(0([Xx][0-9A-Fa-f]+|[0-7]*)|[1-9][0-9]*)/y,
    "identifier": /[A-Z_a-z][0-9A-Z_a-z-]*/y,
    "string": /"[^"]*"/y,
    "whitespace": /[\t\n\r ]+/y,
    "comment": /((\/(\/.*|\*([^*]|\*[^\/])*\*\/)[\t\n\r ]*)+)/y,
    "other": /[^\t\n\r 0-9A-Z_a-z]/y
  };

  function tokenise(str) {
    const tokens = [];
    let lastIndex = 0;
    let trivia = "";
    while (lastIndex < str.length) {
      const nextChar = str.charAt(lastIndex);
      let result = -1;

      if (/[\t\n\r ]/.test(nextChar)) {
        result = attemptTokenMatch("whitespace", true);
      } else if (nextChar === '/') {
        result = attemptTokenMatch("comment", true);
      }

      if (result !== -1) {
        trivia += tokens.pop().value;
      } else if (/[-0-9.]/.test(nextChar)) {
        result = attemptTokenMatch("float");
        if (result === -1) {
          result = attemptTokenMatch("integer");
        }
        if (result === -1) {
          // '-' and '.' can also match "other".
          result = attemptTokenMatch("other");
        }
      } else if (/[A-Z_a-z]/.test(nextChar)) {
        result = attemptTokenMatch("identifier");
      } else if (nextChar === '"') {
        result = attemptTokenMatch("string");
        if (result === -1) {
          // '"' can also match "other".
          result = attemptTokenMatch("other");
        }
      } else {
        result = attemptTokenMatch("other");
      }
      if (result === -1) {
        throw new Error("Token stream not progressing");
      }
      lastIndex = result;
    }
    return tokens;

    function attemptTokenMatch(type, noFlushTrivia) {
      const re = tokenRe[type];
      re.lastIndex = lastIndex;
      const result = re.exec(str);
      if (result) {
        tokens.push({ type, value: result[0], trivia });
        if (!noFlushTrivia) {
          trivia = "";
        }
        return re.lastIndex;
      }
      return -1;
    }
  }

  class WebIDLParseError {
    constructor(str, line, input, tokens) {
      this.message = str;
      this.line = line;
      this.input = input;
      this.tokens = tokens;
    }

    toString() {
      return `${this.message}, line ${this.line} (tokens: '${this.input}')\n${JSON.stringify(this.tokens, null, 4)}`;
    }
  }

  function parse(tokens, opt) {
    let line = 1;
    tokens = tokens.slice();
    const names = new Map();
    let current = null;

    const FLOAT = "float";
    const INT = "integer";
    const ID = "identifier";
    const STR = "string";
    const OTHER = "other";

    const EMPTY_OPERATION = Object.freeze({
      type: "operation",
      getter: false,
      setter: false,
      deleter: false,
      static: false,
      stringifier: false
    });

    const EMPTY_IDLTYPE = Object.freeze({
      sequence: false,
      generic: null,
      nullable: false,
      union: false,
      idlType: null,
      extAttrs: []
    });

    function error(str) {
      let tok = "";
      let numTokens = 0;
      const maxTokens = 5;
      while (numTokens < maxTokens && tokens.length > numTokens) {
        tok += tokens[numTokens].value;
        numTokens++;
      }
      // Count newlines preceding the actual errorneous token
      line += count(tokens[0].trivia, "\n");

      let message;
      if (current) {
        message = `Got an error during or right after parsing \`${current.partial ? "partial " : ""}${current.type} ${current.name}\`: ${str}`
      }
      else {
        // throwing before any valid definition
        message = `Got an error before parsing any named definition: ${str}`;
      }

      throw new WebIDLParseError(message, line, tok, tokens.slice(0, maxTokens));
    }

    function sanitize_name(name, type) {
      if (names.has(name)) {
        error(`The name "${name}" of type "${names.get(name)}" is already seen`);
      }
      names.set(name, type);
      return name;
    }

    let last_token = null;

    function consume(type, value) {
      if (!tokens.length || tokens[0].type !== type) return;
      if (typeof value === "undefined" || tokens[0].value === value) {
        last_token = tokens.shift();
        line += count(last_token.trivia, "\n");
        if (type === ID && last_token.value.startsWith('_'))
          last_token.value = last_token.value.substring(1);
        return last_token;
      }
    }

    function unconsume(...toks) {
      for (let tok of toks) {
        line -= count(tok.trivia, "\n");
      }
      tokens.unshift(...toks);
    }

    function count(str, char) {
      let total = 0;
      for (let i = str.indexOf(char); i !== -1; i = str.indexOf(char, i + 1)) {
        ++total;
      }
      return total;
    }

    function integer_type() {
      let ret = "";
      if (consume(ID, "unsigned")) ret = "unsigned ";
      if (consume(ID, "short")) return ret + "short";
      if (consume(ID, "long")) {
        ret += "long";
        if (consume(ID, "long")) return ret + " long";
        return ret;
      }
      if (ret) error("Failed to parse integer type");
    }

    function float_type() {
      let ret = "";
      if (consume(ID, "unrestricted")) ret = "unrestricted ";
      if (consume(ID, "float")) return ret + "float";
      if (consume(ID, "double")) return ret + "double";
      if (ret) error("Failed to parse float type");
    }

    function primitive_type() {
      const num_type = integer_type() || float_type();
      if (num_type) return num_type;
      if (consume(ID, "boolean")) return "boolean";
      if (consume(ID, "byte")) return "byte";
      if (consume(ID, "octet")) return "octet";
    }

    function const_value() {
      if (consume(ID, "true")) return { type: "boolean", value: true };
      if (consume(ID, "false")) return { type: "boolean", value: false };
      if (consume(ID, "null")) return { type: "null" };
      if (consume(ID, "Infinity")) return { type: "Infinity", negative: false };
      if (consume(ID, "NaN")) return { type: "NaN" };
      const ret = consume(FLOAT) || consume(INT);
      if (ret) return { type: "number", value: ret.value };
      const tok = consume(OTHER, "-");
      if (tok) {
        if (consume(ID, "Infinity")) return { type: "Infinity", negative: true };
        else unconsume(tok);
      }
    }

    function type_suffix(obj) {
      while (true) {
        if (consume(OTHER, "?")) {
          if (obj.nullable) error("Can't nullable more than once");
          obj.nullable = true;
        } else return;
      }
    }

    function single_type(typeName) {
      const prim = primitive_type();
      const ret = Object.assign({ type: typeName || null }, EMPTY_IDLTYPE);
      let name;
      let value;
      if (prim) {
        ret.idlType = prim;
      } else if (name = consume(ID)) {
        value = name.value;
        // Generic types
        if (consume(OTHER, "<")) {
          // backwards compat
          if (value === "sequence") {
            ret.sequence = true;
          }
          ret.generic = value;
          const types = [];
          do {
            types.push(type_with_extended_attributes(typeName) || error("Error parsing generic type " + value));
          }
          while (consume(OTHER, ","));
          if (value === "sequence") {
            if (types.length !== 1) error("A sequence must have exactly one subtype");
          } else if (value === "record") {
            if (types.length !== 2) error("A record must have exactly two subtypes");
            if (!/^(DOMString|USVString|ByteString)$/.test(types[0].idlType)) {
              error("Record key must be DOMString, USVString, or ByteString");
            }
            if (types[0].extAttrs.length) error("Record key cannot have extended attribute");
          } else if (value === "Promise") {
            if (types[0].extAttrs.length) error("Promise type cannot have extended attribute");
          }
          ret.idlType = types.length === 1 ? types[0] : types;
          if (!consume(OTHER, ">")) error("Unterminated generic type " + value);
          type_suffix(ret);
          return ret;
        } else {
          ret.idlType = value;
        }
      } else {
        return;
      }
      type_suffix(ret);
      if (ret.nullable && ret.idlType === "any") error("Type any cannot be made nullable");
      return ret;
    }

    function union_type(typeName) {
      if (!consume(OTHER, "(")) return;
      const ret = Object.assign({ type: typeName || null }, EMPTY_IDLTYPE, { union: true, idlType: [] });
      const fst = type_with_extended_attributes() || error("Union type with no content");
      ret.idlType.push(fst);
      while (true) {
        if (!consume(ID, "or")) break;
        const typ = type_with_extended_attributes() || error("No type after 'or' in union type");
        ret.idlType.push(typ);
      }
      if (!consume(OTHER, ")")) error("Unterminated union type");
      type_suffix(ret);
      return ret;
    }

    function type(typeName) {
      return single_type(typeName) || union_type(typeName);
    }

    function type_with_extended_attributes(typeName) {
      const extAttrs = extended_attrs();
      const ret = single_type(typeName) || union_type(typeName);
      if (extAttrs.length && ret) ret.extAttrs = extAttrs;
      return ret;
    }

    function argument() {
      const ret = { optional: false, variadic: false };
      ret.extAttrs = extended_attrs();
      const opt_token = consume(ID, "optional");
      if (opt_token) {
        ret.optional = true;
      }
      ret.idlType = type_with_extended_attributes("argument-type");
      if (!ret.idlType) {
        if (opt_token) unconsume(opt_token);
        return;
      }
      const type_token = last_token;
      if (!ret.optional) {
        if (tokens.length >= 3 &&
          tokens[0].type === "other" && tokens[0].value === "." &&
          tokens[1].type === "other" && tokens[1].value === "." &&
          tokens[2].type === "other" && tokens[2].value === "."
        ) {
          tokens.shift();
          tokens.shift();
          tokens.shift();
          ret.variadic = true;
        }
      }
      const name = consume(ID);
      if (!name) {
        if (opt_token) unconsume(opt_token);
        unconsume(type_token);
        return;
      }
      ret.name = name.value;
      if (ret.optional) {
        const dflt = default_();
        if (typeof dflt !== "undefined") {
          ret["default"] = dflt;
        }
      }
      return ret;
    }

    function argument_list() {
      const ret = [];
      const arg = argument();
      if (!arg) return ret;
      ret.push(arg);
      while (true) {
        if (!consume(OTHER, ",")) return ret;
        const nxt = argument() || error("Trailing comma in arguments list");
        ret.push(nxt);
      }
    }

    function simple_extended_attr() {
      const name = consume(ID);
      if (!name) return;
      const ret = {
        name: name.value,
        arguments: null,
        type: "extended-attribute",
        rhs: null
      };
      const eq = consume(OTHER, "=");
      if (eq) {
        ret.rhs = consume(ID) ||
          consume(FLOAT) ||
          consume(INT) ||
          consume(STR);
        if (ret.rhs) {
          // No trivia exposure yet
          ret.rhs.trivia = undefined;
        }
      }
      if (consume(OTHER, "(")) {
        if (eq && !ret.rhs) {
          // [Exposed=(Window,Worker)]
          ret.rhs = {
            type: "identifier-list",
            value: identifiers()
          };
        }
        else {
          // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
          ret.arguments = argument_list();
        }
        consume(OTHER, ")") || error("Unexpected token in extended attribute argument list");
      }
      if (eq && !ret.rhs) error("No right hand side to extended attribute assignment");
      return ret;
    }

    // Note: we parse something simpler than the official syntax. It's all that ever
    // seems to be used
    function extended_attrs() {
      const eas = [];
      if (!consume(OTHER, "[")) return eas;
      eas[0] = simple_extended_attr() || error("Extended attribute with not content");
      while (consume(OTHER, ",")) {
        eas.push(simple_extended_attr() || error("Trailing comma in extended attribute"));
      }
      consume(OTHER, "]") || error("No end of extended attribute");
      return eas;
    }

    function default_() {
      if (consume(OTHER, "=")) {
        const def = const_value();
        if (def) {
          return def;
        } else if (consume(OTHER, "[")) {
          if (!consume(OTHER, "]")) error("Default sequence value must be empty");
          return { type: "sequence", value: [] };
        } else {
          const str = consume(STR) || error("No value for default");
          str.value = str.value.slice(1, -1);
          // No trivia exposure yet
          str.trivia = undefined;
          return str;
        }
      }
    }

    function const_() {
      if (!consume(ID, "const")) return;
      const ret = { type: "const", nullable: false };
      let typ = primitive_type();
      if (!typ) {
        typ = consume(ID) || error("No type for const");
        typ = typ.value;
      }
      ret.idlType = Object.assign({ type: "const-type" }, EMPTY_IDLTYPE, { idlType: typ });
      if (consume(OTHER, "?")) {
        ret.nullable = true;
      }
      const name = consume(ID) || error("No name for const");
      ret.name = name.value;
      consume(OTHER, "=") || error("No value assignment for const");
      const cnt = const_value();
      if (cnt) ret.value = cnt;
      else error("No value for const");
      consume(OTHER, ";") || error("Unterminated const");
      return ret;
    }

    function inheritance() {
      if (consume(OTHER, ":")) {
        const inh = consume(ID) || error("No type in inheritance");
        return inh.value;
      }
    }

    function operation_rest(ret) {
      if (!ret) ret = {};
      const name = consume(ID);
      ret.name = name ? name.value : null;
      consume(OTHER, "(") || error("Invalid operation");
      ret.arguments = argument_list();
      consume(OTHER, ")") || error("Unterminated operation");
      consume(OTHER, ";") || error("Unterminated operation");
      return ret;
    }

    function callback() {
      let ret;
      if (!consume(ID, "callback")) return;
      const tok = consume(ID, "interface");
      if (tok) {
        ret = interface_rest(false, "callback interface");
        return ret;
      }
      const name = consume(ID) || error("No name for callback");
      ret = current = { type: "callback", name: sanitize_name(name.value, "callback") };
      consume(OTHER, "=") || error("No assignment in callback");
      ret.idlType = return_type();
      consume(OTHER, "(") || error("No arguments in callback");
      ret.arguments = argument_list();
      consume(OTHER, ")") || error("Unterminated callback");
      consume(OTHER, ";") || error("Unterminated callback");
      return ret;
    }

    function attribute() {
      const grabbed = [];
      const ret = {
        type: "attribute",
        static: false,
        stringifier: false,
        inherit: false,
        readonly: false
      };
      if (consume(ID, "inherit")) {
        if (ret.static || ret.stringifier) error("Cannot have a static or stringifier inherit");
        ret.inherit = true;
        grabbed.push(last_token);
      }
      if (consume(ID, "readonly")) {
        ret.readonly = true;
        grabbed.push(last_token);
      }
      const rest = attribute_rest(ret);
      if (!rest) {
        unconsume(...grabbed);
      }
      return rest;
    }

    function attribute_rest(ret) {
      if (!consume(ID, "attribute")) {
        return;
      }
      ret.idlType = type_with_extended_attributes("attribute-type") || error("No type in attribute");
      if (ret.idlType.sequence) error("Attributes cannot accept sequence types");
      if (ret.idlType.generic === "record") error("Attributes cannot accept record types");
      const name = consume(ID) || error("No name in attribute");
      ret.name = name.value;
      consume(OTHER, ";") || error("Unterminated attribute");
      return ret;
    }

    function return_type() {
      const typ = type("return-type");
      if (!typ) {
        if (consume(ID, "void")) {
          return "void";
        } else error("No return type");
      }
      return typ;
    }

    function operation() {
      const ret = Object.assign({}, EMPTY_OPERATION);
      while (true) {
        if (consume(ID, "getter")) ret.getter = true;
        else if (consume(ID, "setter")) ret.setter = true;
        else if (consume(ID, "deleter")) ret.deleter = true;
        else break;
      }
      if (ret.getter || ret.setter || ret.deleter) {
        ret.idlType = return_type();
        operation_rest(ret);
        return ret;
      }
      ret.idlType = return_type();
      operation_rest(ret);
      return ret;
    }

    function static_member() {
      if (!consume(ID, "static")) return;
      return noninherited_attribute("static") ||
        regular_operation("static") ||
        error("No body in static member");
    }

    function stringifier() {
      if (!consume(ID, "stringifier")) return;
      if (consume(OTHER, ";")) {
        return Object.assign({}, EMPTY_OPERATION, { stringifier: true });
      }
      return noninherited_attribute("stringifier") ||
        regular_operation("stringifier") ||
        error("Unterminated stringifier");
    }

    function identifiers() {
      const arr = [];
      const id = consume(ID);
      if (id) {
        arr.push(id.value);
      }
      else error("Expected identifiers but not found");
      while (true) {
        if (consume(OTHER, ",")) {
          const name = consume(ID) || error("Trailing comma in identifiers list");
          arr.push(name.value);
        } else break;
      }
      return arr;
    }

    function iterable_type() {
      if (consume(ID, "iterable")) return "iterable";
      else if (consume(ID, "legacyiterable")) return "legacyiterable";
      else if (consume(ID, "maplike")) return "maplike";
      else if (consume(ID, "setlike")) return "setlike";
      else return;
    }

    function readonly_iterable_type() {
      if (consume(ID, "maplike")) return "maplike";
      else if (consume(ID, "setlike")) return "setlike";
      else return;
    }

    function iterable() {
      const grabbed = [];
      const ret = { type: null, idlType: null, readonly: false };
      if (consume(ID, "readonly")) {
        ret.readonly = true;
        grabbed.push(last_token);
      }
      const consumeItType = ret.readonly ? readonly_iterable_type : iterable_type;

      const ittype = consumeItType();
      if (!ittype) {
        unconsume(...grabbed);
        return;
      }

      const secondTypeRequired = ittype === "maplike";
      const secondTypeAllowed = secondTypeRequired || ittype === "iterable";
      ret.type = ittype;
      if (ret.type !== 'maplike' && ret.type !== 'setlike')
        delete ret.readonly;
      if (consume(OTHER, "<")) {
        ret.idlType = [type_with_extended_attributes()] || error(`Error parsing ${ittype} declaration`);
        if (secondTypeAllowed) {
          if (consume(OTHER, ",")) {
            ret.idlType.push(type_with_extended_attributes());
          }
          else if (secondTypeRequired)
            error(`Missing second type argument in ${ittype} declaration`);
        }
        if (!consume(OTHER, ">")) error(`Unterminated ${ittype} declaration`);
        if (!consume(OTHER, ";")) error(`Missing semicolon after ${ittype} declaration`);
      } else
        error(`Error parsing ${ittype} declaration`);

      return ret;
    }

    function interface_rest(isPartial, typeName = "interface") {
      const name = consume(ID) || error("No name for interface");
      const mems = [];
      const ret = current = {
        type: typeName,
        name: isPartial ? name.value : sanitize_name(name.value, "interface"),
        partial: isPartial,
        members: mems
      };
      if (!isPartial) ret.inheritance = inheritance() || null;
      consume(OTHER, "{") || error("Bodyless interface");
      while (true) {
        if (consume(OTHER, "}")) {
          consume(OTHER, ";") || error("Missing semicolon after interface");
          return ret;
        }
        const ea = extended_attrs();
        const cnt = const_();
        if (cnt) {
          cnt.extAttrs = ea;
          ret.members.push(cnt);
          continue;
        }
        const mem = (opt.allowNestedTypedefs && typedef()) ||
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

    function mixin_rest(isPartial) {
      if (!consume(ID, "mixin")) return;
      const name = consume(ID) || error("No name for interface mixin");
      const mems = [];
      const ret = current = {
        type: "interface mixin",
        name: isPartial ? name.value : sanitize_name(name.value, "interface mixin"),
        partial: isPartial,
        members: mems
      };
      consume(OTHER, "{") || error("Bodyless interface mixin");
      while (true) {
        if (consume(OTHER, "}")) {
          consume(OTHER, ";") || error("Missing semicolon after interface mixin");
          return ret;
        }
        const ea = extended_attrs();
        const cnt = const_();
        if (cnt) {
          cnt.extAttrs = ea;
          ret.members.push(cnt);
          continue;
        }
        const mem = stringifier() ||
          noninherited_attribute() ||
          regular_operation() ||
          error("Unknown member");
        mem.extAttrs = ea;
        ret.members.push(mem);
      }
    }

    function interface_(isPartial) {
      if (!consume(ID, "interface")) return;
      return mixin_rest(isPartial) ||
        interface_rest(isPartial) ||
        error("Interface has no proper body");
    }

    function namespace(isPartial) {
      if (!consume(ID, "namespace")) return;
      const name = consume(ID) || error("No name for namespace");
      const mems = [];
      const ret = current = {
        type: "namespace",
        name: isPartial ? name.value : sanitize_name(name.value, "namespace"),
        partial: isPartial,
        members: mems
      };
      consume(OTHER, "{") || error("Bodyless namespace");
      while (true) {
        if (consume(OTHER, "}")) {
          consume(OTHER, ";") || error("Missing semicolon after namespace");
          return ret;
        }
        const ea = extended_attrs();
        const mem = noninherited_attribute() ||
          regular_operation() ||
          error("Unknown member");
        mem.extAttrs = ea;
        ret.members.push(mem);
      }
    }

    function noninherited_attribute(prefix) {
      const grabbed = [];
      const ret = {
        type: "attribute",
        static: false,
        stringifier: false,
        inherit: false,
        readonly: false
      };
      if (prefix) {
        ret[prefix] = true;
      }
      if (consume(ID, "readonly")) {
        ret.readonly = true;
        grabbed.push(last_token);
      }
      const rest = attribute_rest(ret);
      if (!rest) {
        unconsume(...grabbed);
      }
      return rest;
    }

    function regular_operation(prefix) {
      const ret = Object.assign({}, EMPTY_OPERATION);
      if (prefix) {
        ret[prefix] = true;
      }
      ret.idlType = return_type();
      return operation_rest(ret);
    }

    function partial() {
      if (!consume(ID, "partial")) return;
      const thing = dictionary(true) ||
        interface_(true) ||
        namespace(true) ||
        error("Partial doesn't apply to anything");
      return thing;
    }

    function dictionary(isPartial) {
      if (!consume(ID, "dictionary")) return;
      const name = consume(ID) || error("No name for dictionary");
      const mems = [];
      const ret = current = {
        type: "dictionary",
        name: isPartial ? name.value : sanitize_name(name.value, "dictionary"),
        partial: isPartial,
        members: mems
      };
      if (!isPartial) ret.inheritance = inheritance() || null;
      consume(OTHER, "{") || error("Bodyless dictionary");
      while (true) {
        if (consume(OTHER, "}")) {
          consume(OTHER, ";") || error("Missing semicolon after dictionary");
          return ret;
        }
        const ea = extended_attrs();
        const required = consume(ID, "required");
        const typ = type_with_extended_attributes("dictionary-type") || error("No type for dictionary member");
        const name = consume(ID) || error("No name for dictionary member");
        const dflt = default_();
        if (required && dflt) error("Required member must not have a default");
        const member = {
          type: "field",
          name: name.value,
          required: !!required,
          idlType: typ,
          extAttrs: ea
        };
        if (typeof dflt !== "undefined") {
          member["default"] = dflt;
        }
        ret.members.push(member);
        consume(OTHER, ";") || error("Unterminated dictionary member");
      }
    }

    function enum_() {
      if (!consume(ID, "enum")) return;
      const name = consume(ID) || error("No name for enum");
      const vals = [];
      const ret = current = {
        type: "enum",
        name: sanitize_name(name.value, "enum"),
        values: vals
      };
      consume(OTHER, "{") || error("No curly for enum");
      let value_expected = true;
      while (true) {
        if (consume(OTHER, "}")) {
          if (!ret.values.length) error("No value in enum");
          consume(OTHER, ";") || error("No semicolon after enum");
          return ret;
        }
        else if (!value_expected) {
          error("No comma between enum values");
        }
        const val = consume(STR) || error("Unexpected value in enum");
        val.value = val.value.slice(1, -1);
        // No trivia exposure yet
        val.trivia = undefined;
        ret.values.push(val);
        if (consume(OTHER, ",")) {
          value_expected = true;
        } else {
          value_expected = false;
        }
      }
    }

    function typedef() {
      if (!consume(ID, "typedef")) return;
      const ret = {
        type: "typedef"
      };
      ret.idlType = type_with_extended_attributes("typedef-type") || error("No type in typedef");
      const name = consume(ID) || error("No name in typedef");
      ret.name = sanitize_name(name.value, "typedef");
      current = ret;
      consume(OTHER, ";") || error("Unterminated typedef");
      return ret;
    }

    function implements_() {
      const target = consume(ID);
      if (!target) return;
      if (consume(ID, "implements")) {
        const ret = {
          type: "implements",
          target: target.value
        };
        const imp = consume(ID) || error("Incomplete implements statement");
        ret["implements"] = imp.value;
        consume(OTHER, ";") || error("No terminating ; for implements statement");
        return ret;
      } else {
        // rollback
        unconsume(target);
      }
    }

    function includes() {
      const target = consume(ID);
      if (!target) return;
      if (consume(ID, "includes")) {
        const ret = {
          type: "includes",
          target: target.value
        };
        const imp = consume(ID) || error("Incomplete includes statement");
        ret["includes"] = imp.value;
        consume(OTHER, ";") || error("No terminating ; for includes statement");
        return ret;
      } else {
        // rollback
        unconsume(target);
      }
    }

    function definition() {
      return callback() ||
        interface_(false) ||
        partial() ||
        dictionary(false) ||
        enum_() ||
        typedef() ||
        implements_() ||
        includes() ||
        namespace(false);
    }

    function definitions() {
      if (!tokens.length) return [];
      const defs = [];
      while (true) {
        const ea = extended_attrs();
        const def = definition();
        if (!def) {
          if (ea.length) error("Stray extended attributes");
          break;
        }
        def.extAttrs = ea;
        defs.push(def);
      }
      return defs;
    }
    const res = definitions();
    if (tokens.length) error("Unrecognised tokens");
    return res;
  }

  const obj = {
    parse(str, opt) {
      if (!opt) opt = {};
      const tokens = tokenise(str);
      return parse(tokens, opt);
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
