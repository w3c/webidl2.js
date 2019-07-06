"use strict";

import { const_data, const_value, unescape, primitive_type, argument_list, type_with_extended_attributes, return_type } from "./productions/helpers.js";
import { Tokeniser } from "./tokeniser.js";
import { Base } from "./productions/base.js";
import { Default } from "./productions/default.js";
import { Enum } from "./productions/enum.js";
import { Includes } from "./productions/includes.js";
import { Type } from "./productions/type.js";
import { ExtendedAttributes } from "./productions/extended-attributes.js";
import { Attribute } from "./productions/attribute.js";
import { Operation } from "./productions/operation.js";

/**
 * @param {Tokeniser} tokeniser
 * @param {object} options
 * @param {boolean} [options.concrete]
 */
function parseByTokens(tokeniser, options) {
  const source = tokeniser.source;

  const ID = "identifier";

  function error(str) {
    tokeniser.error(str);
  }

  function probe(type) {
    return tokeniser.probe(type);
  }

  function consume(...candidates) {
    return tokeniser.consume(...candidates);
  }

  function unconsume(position) {
    return tokeniser.unconsume(position);
  }

  class Constant extends Base {
    static parse() {
      const tokens = {};
      tokens.base = consume("const");
      if (!tokens.base) {
        return;
      }
      let idlType = primitive_type(tokeniser);
      if (!idlType) {
        const base = consume(ID) || error("No type for const");
        idlType = new Type({ source, tokens: { base } });
      }
      if (probe("?")) {
        error("Unexpected nullable constant type");
      }
      idlType.type = "const-type";
      tokens.name = consume(ID) || error("No name for const");
      tokens.assign = consume("=") || error("No value assignment for const");
      tokens.value = const_value(tokeniser) || error("No value for const");
      tokens.termination = consume(";") || error("Unterminated const");
      const ret = new Constant({ source, tokens });
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

  class CallbackFunction extends Base {
    static parse(base) {
      const tokens = { base };
      const ret = new CallbackFunction({ source, tokens });
      tokens.name = consume(ID) || error("No name for callback");
      tokeniser.current = ret;
      tokens.assign = consume("=") || error("No assignment in callback");
      ret.idlType = return_type(tokeniser) || error("Missing return type");
      tokens.open = consume("(") || error("No arguments in callback");
      ret.arguments = argument_list(tokeniser);
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

  function static_member() {
    const special = consume("static");
    if (!special) return;
    const member = Attribute.parse(tokeniser, { special }) ||
      Operation.parse(tokeniser, { special }) ||
      error("No body in static member");
    return member;
  }

  function stringifier() {
    const special = consume("stringifier");
    if (!special) return;
    const member = Attribute.parse(tokeniser, { special }) ||
      Operation.parse(tokeniser, { special }) ||
      error("Unterminated stringifier");
    return member;
  }

  class IterableLike extends Base {
    static parse() {
      const start_position = tokeniser.position;
      const tokens = {};
      const ret = new IterableLike({ source, tokens });
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
      const first = type_with_extended_attributes(tokeniser) || error(`Error parsing ${type} declaration`);
      ret.idlType = [first];
      if (secondTypeAllowed) {
        first.tokens.separator = consume(",");
        if (first.tokens.separator) {
          ret.idlType.push(type_with_extended_attributes(tokeniser));
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
      return !!this.tokens.readonly;
    }
  }

  function inheritance() {
    const colon = consume(":");
    if (!colon) {
      return {};
    }
    const inheritance = consume(ID) || error("No type in inheritance");
    return { colon, inheritance };
  }

  class Container extends Base {
    static parse(instance, { type, inheritable, allowedMembers }) {
      const { tokens } = instance;
      tokens.name = consume(ID) || error("No name for interface");
      tokeniser.current = instance;
      if (inheritable) {
        Object.assign(tokens, inheritance());
      }
      tokens.open = consume("{") || error(`Bodyless ${type}`);
      instance.members = [];
      while (true) {
        tokens.close = consume("}");
        if (tokens.close) {
          tokens.termination = consume(";") || error(`Missing semicolon after ${type}`);
          return instance;
        }
        const ea = ExtendedAttributes.parse(tokeniser);
        let mem;
        for (const [parser, ...args] of allowedMembers) {
          mem = parser(tokeniser, ...args);
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
      return !!this.tokens.partial;
    }
    get name() {
      return unescape(this.tokens.name.value);
    }
    get inheritance() {
      if (!this.tokens.inheritance) {
        return null;
      }
      return unescape(this.tokens.inheritance.value);
    }
  }

  class Interface extends Container {
    static parse(base, { callback = null, partial = null } = {}) {
      const tokens = { callback, partial, base };
      return Container.parse(new Interface({ source, tokens }), {
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
      return Container.parse(new Mixin({ source, tokens }), {
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
      return Container.parse(new Namespace({ source, tokens }), {
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
      return Container.parse(new Dictionary({ source, tokens }), {
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

  class Field extends Base {
    static parse() {
      const tokens = {};
      const ret = new Field({ source, tokens });
      ret.extAttrs = ExtendedAttributes.parse(tokeniser);
      tokens.required = consume("required");
      ret.idlType = type_with_extended_attributes(tokeniser, "dictionary-type") || error("No type for dictionary member");
      tokens.name = consume(ID) || error("No name for dictionary member");
      ret.default = Default.parse(tokeniser);
      if (tokens.required && ret.default) error("Required member must not have a default");
      tokens.termination = consume(";") || error("Unterminated dictionary member");
      return ret;
    }

    get type() {
      return "field";
    }
    get name() {
      return unescape(this.tokens.name.value);
    }
    get required() {
      return !!this.tokens.required;
    }
  }

  class Typedef extends Base {
    static parse() {
      const tokens = {};
      const ret = new Typedef({ source, tokens });
      tokens.base = consume("typedef");
      if (!tokens.base) {
        return;
      }
      ret.idlType = type_with_extended_attributes(tokeniser, "typedef-type") || error("No type in typedef");
      tokens.name = consume(ID) || error("No name in typedef");
      tokeniser.current = ret;
      tokens.termination = consume(";") || error("Unterminated typedef");
      return ret;
    }

    get type() {
      return "typedef";
    }
    get name() {
      return unescape(this.tokens.name.value);
    }
  }

  function definition() {
    return callback() ||
      interface_() ||
      partial() ||
      Dictionary.parse() ||
      Enum.parse(tokeniser) ||
      Typedef.parse() ||
      Includes.parse(tokeniser) ||
      Namespace.parse();
  }

  function definitions() {
    if (!source.length) return [];
    const defs = [];
    while (true) {
      const ea = ExtendedAttributes.parse(tokeniser);
      const def = definition();
      if (!def) {
        if (ea.length) error("Stray extended attributes");
        break;
      }
      def.extAttrs = ea;
      defs.push(def);
    }
    const eof = consume("eof");
    if (options.concrete) {
      defs.push(eof);
    }
    return defs;
  }
  const res = definitions();
  if (tokeniser.position < source.length) error("Unrecognised tokens");
  return res;
}

export function parse(str, options = {}) {
  const tokeniser = new Tokeniser(str);
  return parseByTokens(tokeniser, options);
}
