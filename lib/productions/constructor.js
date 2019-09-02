import { Base } from "./base.js";
import { argument_list } from "./helpers.js";

export class Constructor extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const base = tokeniser.consume("constructor");
    if (!base) {
      return;
    }
    const tokens = { base };
    tokens.open = tokeniser.consume("(") || tokeniser.error("No argument list in constructor");
    const args = argument_list(tokeniser);
    tokens.close = tokeniser.consume(")") || tokeniser.error("Unterminated constructor");
    tokens.termination = tokeniser.consume(";") || tokeniser.error("No semicolon after constructor");
    const ret = new Constructor({ tokens });
    ret.arguments = args;
    return ret;
  }

  get type() {
    return "constructor";
  }

  *validate(defs) {
    if (this.idlType) {
      yield* this.idlType.validate(defs);
    }
    for (const argument of this.arguments) {
      yield* argument.validate(defs);
    }
  }
}
