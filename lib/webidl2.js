import { Tokeniser, WebIDLParseError, reserved } from "./tokeniser.js";
import { syntaxError } from "./error.js";
import { Enum } from "./productions/enum.js";
import { Includes } from "./productions/includes.js";
import { ExtendedAttributes } from "./productions/extended-attributes.js";
import { Typedef } from "./productions/typedef.js";
import { CallbackFunction } from "./productions/callback.js";
import { Interface } from "./productions/interface.js";
import { Mixin } from "./productions/mixin.js";
import { Dictionary } from "./productions/dictionary.js";
import { Namespace } from "./productions/namespace.js";
import { CallbackInterface } from "./productions/callback-interface.js";
import { autoParenter, unescape } from "./productions/helpers.js";
import { Eof } from "./productions/token.js";

/** @typedef {'callbackInterface'|'dictionary'|'interface'|'mixin'|'namespace'} ExtendableInterfaces */
/** @typedef {{ extMembers?: import("./productions/container.js").AllowedMember[]}} Extension */
/** @typedef {Partial<Record<ExtendableInterfaces, Extension>>} Extensions */

/**
 * Parser options.
 * @typedef {Object} ParserOptions
 * @property {string} [sourceName]
 * @property {boolean} [concrete]
 * @property {Function[]} [productions]
 * @property {Extensions} [extensions]
 */

/**
 * @param {Tokeniser} tokeniser
 * @param {ParserOptions} options
 */
function parseByTokens(tokeniser, options) {
  const source = tokeniser.source;

  function error(str) {
    tokeniser.error(str);
  }

  function consume(...candidates) {
    return tokeniser.consume(...candidates);
  }

  function callback() {
    const callback = consume("callback");
    if (!callback) return;
    if (tokeniser.probe("interface")) {
      return CallbackInterface.parse(tokeniser, callback, {
        ...options?.extensions?.callbackInterface,
      });
    }
    return CallbackFunction.parse(tokeniser, callback);
  }

  function interface_(opts) {
    const base = consume("interface");
    if (!base) return;
    return (
      Mixin.parse(tokeniser, base, {
        ...opts,
        ...options?.extensions?.mixin,
      }) ||
      Interface.parse(tokeniser, base, {
        ...opts,
        ...options?.extensions?.interface,
      }) ||
      error("Interface has no proper body")
    );
  }

  function partial() {
    const partial = consume("partial");
    if (!partial) return;
    return (
      Dictionary.parse(tokeniser, {
        partial,
        ...options?.extensions?.dictionary,
      }) ||
      interface_({ partial }) ||
      Namespace.parse(tokeniser, {
        partial,
        ...options?.extensions?.namespace,
      }) ||
      error("Partial doesn't apply to anything")
    );
  }

  function definition() {
    if (options.productions) {
      for (const production of options.productions) {
        const result = production(tokeniser);
        if (result) {
          return result;
        }
      }
    }

    return (
      callback() ||
      interface_() ||
      partial() ||
      Dictionary.parse(tokeniser, options?.extensions?.dictionary) ||
      Enum.parse(tokeniser) ||
      Typedef.parse(tokeniser) ||
      Includes.parse(tokeniser) ||
      Namespace.parse(tokeniser, options?.extensions?.namespace)
    );
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
      autoParenter(def).extAttrs = ea;
      defs.push(def);
    }
    const eof = Eof.parse(tokeniser);
    if (options.concrete) {
      defs.push(eof);
    }
    return defs;
  }

  const res = definitions();
  if (tokeniser.position < source.length) error("Unrecognised tokens");
  checkReservedIdentifiers(tokeniser, res);
  return res;
}

/**
 * Reserved identifiers are allowed only as operation argument names.
 * https://webidl.spec.whatwg.org/#idl-names
 * @param {Tokeniser} tokeniser
 * @param {object[]} defs
 */
function checkReservedIdentifiers(tokeniser, defs) {
  /** Name tokens of argument productions, which may be reserved. */
  const allowed = new Set();
  const seen = new Set();
  /** @param {*} node */
  function walk(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.type === "argument") {
      allowed.add(node.tokens.name);
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  }
  walk(defs);
  for (const token of tokeniser.source) {
    if (
      token.type === "identifier" &&
      reserved.includes(token.value) &&
      !allowed.has(token)
    ) {
      const message = `${unescape(
        token.value,
      )} is a reserved identifier and must not be used.`;
      throw new WebIDLParseError(
        syntaxError(tokeniser.source, token.index, null, message),
      );
    }
  }
}

/**
 * @param {string} str
 * @param {ParserOptions} [options]
 */
export function parse(str, options = {}) {
  const tokeniser = new Tokeniser(str);
  if (typeof options.sourceName !== "undefined") {
    // @ts-ignore (See Tokeniser.source in supplement.d.ts)
    tokeniser.source.name = options.sourceName;
  }
  return parseByTokens(tokeniser, options);
}
