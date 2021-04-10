import { Base } from "./base.js";
import {
  type_with_extended_attributes,
  autoParenter,
  argument_list,
} from "./helpers.js";

export class IterableLike extends Base {
  /**
   * @param {import("../tokeniser.js").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const start_position = tokeniser.position;
    const tokens = {};
    const ret = autoParenter(
      new IterableLike({ source: tokeniser.source, tokens })
    );
    tokens.readonly = tokeniser.consume("readonly");
    if (!tokens.readonly) {
      tokens.async = tokeniser.consume("async");
    }
    tokens.base = tokens.readonly
      ? tokeniser.consume("maplike", "setlike")
      : tokens.async
      ? tokeniser.consume("iterable")
      : tokeniser.consume("iterable", "maplike", "setlike");
    if (!tokens.base) {
      tokeniser.unconsume(start_position);
      return;
    }

    const { type } = ret;
    const secondTypeRequired = type === "maplike";
    const secondTypeAllowed = secondTypeRequired || type === "iterable";
    const argumentAllowed = ret.async && type === "iterable";

    tokens.open =
      tokeniser.consume("<") ||
      tokeniser.error(`Missing less-than sign \`<\` in ${type} declaration`);
    const first =
      type_with_extended_attributes(tokeniser) ||
      tokeniser.error(`Missing a type argument in ${type} declaration`);
    ret.idlType = [first];
    ret.arguments = [];

    if (secondTypeAllowed) {
      first.tokens.separator = tokeniser.consume(",");
      if (first.tokens.separator) {
        ret.idlType.push(type_with_extended_attributes(tokeniser));
      } else if (secondTypeRequired) {
        tokeniser.error(`Missing second type argument in ${type} declaration`);
      }
    }

    tokens.close =
      tokeniser.consume(">") ||
      tokeniser.error(`Missing greater-than sign \`>\` in ${type} declaration`);

    if (tokeniser.probe("(")) {
      if (argumentAllowed) {
        tokens.argsOpen = tokeniser.consume("(");
        ret.arguments.push(...argument_list(tokeniser));
        tokens.argsClose =
          tokeniser.consume(")") ||
          tokeniser.error("Unterminated async iterable argument list");
      } else {
        tokeniser.error(`Arguments are only allowed for \`async iterable\``);
      }
    }

    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error(`Missing semicolon after ${type} declaration`);

    return ret.this;
  }

  get type() {
    return this.tokens.base.value;
  }
  get readonly() {
    return !!this.tokens.readonly;
  }
  get async() {
    return !!this.tokens.async;
  }

  *validate(defs) {
    for (const type of this.idlType) {
      yield* type.validate(defs);
    }
    for (const argument of this.arguments) {
      yield* argument.validate(defs);
    }
  }
}
