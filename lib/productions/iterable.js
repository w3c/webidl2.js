import { Base } from "./base";
import { type_with_extended_attributes } from "./helpers";

export class IterableLike extends Base {
  /**
   * @param {import("../tokeniser.js").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const start_position = tokeniser.position;
    const tokens = {};
    const ret = new IterableLike({ source: tokeniser.source, tokens });
    tokens.readonly = tokeniser.consume("readonly");
    tokens.base = tokens.readonly ?
      tokeniser.consume("maplike", "setlike") :
      tokeniser.consume("iterable", "maplike", "setlike");
    if (!tokens.base) {
      tokeniser.unconsume(start_position);
      return;
    }

    const { type } = ret;
    const secondTypeRequired = type === "maplike";
    const secondTypeAllowed = secondTypeRequired || type === "iterable";

    tokens.open = tokeniser.consume("<") || tokeniser.error(`Missing brackets in ${type} declaration`);
    const first = type_with_extended_attributes(tokeniser) || tokeniser.error(`Missing a type argument in ${type} declaration`);
    ret.idlType = [first];
    if (secondTypeAllowed) {
      first.tokens.separator = tokeniser.consume(",");
      if (first.tokens.separator) {
        ret.idlType.push(type_with_extended_attributes(tokeniser));
      }
      else if (secondTypeRequired)
      tokeniser.error(`Missing second type argument in ${type} declaration`);
    }
    tokens.close = tokeniser.consume(">") || tokeniser.error(`Unterminated ${type} declaration`);
    tokens.termination = tokeniser.consume(";") || tokeniser.error(`Missing semicolon after ${type} declaration`);

    return ret;
  }

  get type() {
    return this.tokens.base.value;
  }
  get readonly() {
    return !!this.tokens.readonly;
  }
}
