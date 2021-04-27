// @ts-check

import { Base } from "./base.js";
import { unescape } from "./helpers.js";

export class WrappedToken extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   * @param {string} type
   */
  static parser(tokeniser, type) {
    return () => {
      const value = tokeniser.consumeType(type);
      if (value) {
        return new WrappedToken({
          source: tokeniser.source,
          tokens: { value },
        });
      }
    };
  }

  get value() {
    return unescape(this.tokens.value.value);
  }
}
