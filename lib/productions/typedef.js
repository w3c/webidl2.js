import { Base } from "./base.js";
import {
  type_with_extended_attributes,
  unescape,
  autoParenter,
} from "./helpers.js";

export class Typedef extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    /** @type {Base["tokens"]} */
    const tokens = {};
    const ret = autoParenter(new Typedef({ source: tokeniser.source, tokens }));
    tokens.base = tokeniser.consume("typedef");
    if (!tokens.base) {
      return;
    }
    ret.idlType =
      type_with_extended_attributes(tokeniser, "typedef-type") ||
      tokeniser.error("Typedef lacks a type");
    tokens.name =
      tokeniser.consume("identifier") ||
      tokeniser.error("Typedef lacks a name");
    tokeniser.current = ret.this;
    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error("Unterminated typedef, expected `;`");
    return ret.this;
  }

  get type() {
    return "typedef";
  }
  get name() {
    return unescape(this.tokens.name.value);
  }

  *validate(defs) {
    yield* this.idlType.validate(defs);
  }
}
