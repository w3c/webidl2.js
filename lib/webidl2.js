"use strict";

import { Tokeniser } from "./tokeniser.js";
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
import { Module } from "./productions/module.js";

/**
 * @param {Tokeniser} tokeniser
 * @param {object} options
 * @param {boolean} [options.concrete]
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
      return CallbackInterface.parse(tokeniser, callback);
    }
    return CallbackFunction.parse(tokeniser, callback);
  }

  function interface_(opts) {
    const base = consume("interface");
    if (!base) return;
    const ret = Mixin.parse(tokeniser, base, opts) ||
      Interface.parse(tokeniser, base, opts) ||
      error("Interface has no proper body");
    return ret;
  }

  function partial() {
    const partial = consume("partial");
    if (!partial) return;
    return Dictionary.parse(tokeniser, { partial }) ||
      interface_({ partial }) ||
      Namespace.parse(tokeniser, { partial }) ||
      Module.parse(tokeniser, { partial }) ||
      error("Partial doesn't apply to anything");
  }

  function definition() {
    return callback() ||
      interface_() ||
      partial() ||
      Dictionary.parse(tokeniser) ||
      Enum.parse(tokeniser) ||
      Typedef.parse(tokeniser) ||
      Includes.parse(tokeniser) ||
      Namespace.parse(tokeniser) ||
      Module.parse(tokeniser);
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
  if (typeof options.sourceName !== "undefined") {
    tokeniser.source.name = options.sourceName;
  }
  return parseByTokens(tokeniser, options);
}
