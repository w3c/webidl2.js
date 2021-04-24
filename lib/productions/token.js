// @ts-check

import { Base } from "./base.js";
import { unescape } from "./helpers.js";

export class Token extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   * @param {string} type
   */
  static parser(tokeniser, type) {
    return () => {
      const value = tokeniser.consumeType(type);
      if (value) {
        return new Token({ source: tokeniser.source, tokens: { value } });
      }
    };
  }

  get value() {
    return unescape(this.tokens.value.value);
  }

  /** @param {import("../writer").Writer} w */
  write(w) {
    return w.ts.wrap([
      w.token(this.tokens.value),
      w.token(this.tokens.separator),
    ]);
  }
}

export class Eof extends Token {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const value = tokeniser.consumeType("eof");
    if (value) {
      return new Eof({ source: tokeniser.source, tokens: { value } });
    }
  }

  get type() {
    return "eof";
  }
}
