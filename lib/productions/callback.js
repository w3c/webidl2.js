import { Base } from "./base";
import { return_type, argument_list, unescape } from "./helpers";

export class CallbackFunction extends Base {
  /**
   * @param {import("../tokeniser.js").Tokeniser} tokeniser
   */
  static parse(tokeniser, base) {
    const tokens = { base };
    const ret = new CallbackFunction({ source: tokeniser.source, tokens });
    tokens.name = tokeniser.consume("identifier") || tokeniser.error("Callback lacks a name");
    tokeniser.current = ret;
    tokens.assign = tokeniser.consume("=") || tokeniser.error("Callback lacks an assignment");
    ret.idlType = return_type(tokeniser) || tokeniser.error("Callback lacks a return type");
    tokens.open = tokeniser.consume("(") || tokeniser.error("Callback lacks parentheses for arguments");
    ret.arguments = argument_list(tokeniser);
    tokens.close = tokeniser.consume(")") || tokeniser.error("Unterminated callback");
    tokens.termination = tokeniser.consume(";") || tokeniser.error("Unterminated callback, expected `;`");
    return ret;
  }

  get type() {
    return "callback";
  }
  get name() {
    return unescape(this.tokens.name.value);
  }

  *validate(defs) {
    yield* this.idlType.validate(defs);
  }
}
