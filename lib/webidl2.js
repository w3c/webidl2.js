"use strict";

import { unescape } from "./productions/helpers.js";
import { Tokeniser } from "./tokeniser.js";
import { Base } from "./productions/base.js";
import { Enum } from "./productions/enum.js";
import { Includes } from "./productions/includes.js";
import { ExtendedAttributes } from "./productions/extended-attributes.js";
import { Attribute } from "./productions/attribute.js";
import { Operation } from "./productions/operation.js";
import { Constant } from "./productions/constant.js";
import { Typedef } from "./productions/typedef.js";
import { Field } from "./productions/field.js";
import { CallbackFunction } from "./productions/callback.js";
import { IterableLike } from "./productions/iterable.js";

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

  function consume(...candidates) {
    return tokeniser.consume(...candidates);
  }

  function callback() {
    const callback = consume("callback");
    if (!callback) return;
    const tok = consume("interface");
    if (tok) {
      return Interface.parse(tok, { callback });
    }
    return CallbackFunction.parse(tokeniser, callback);
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

  function definition() {
    return callback() ||
      interface_() ||
      partial() ||
      Dictionary.parse() ||
      Enum.parse(tokeniser) ||
      Typedef.parse(tokeniser) ||
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
