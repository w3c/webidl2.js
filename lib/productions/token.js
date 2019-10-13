import { Base } from "./base.js";

export class Token extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   * @param {string} type
   */
  static parser(tokeniser, type) {
    return () => {
      const value = tokeniser.consume(type);
      if (value) {
        return new Token({ source: tokeniser.source, tokens: { value } });
      }
    };
  }

  get value() {
    const { value } = this.tokens;
    if (value.type === "string") {
      return value.value.slice(1, -1);
    }
    return value.value;
  }
}
