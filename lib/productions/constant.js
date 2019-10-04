import { Base } from "./base.js";
import { Type } from "./type.js";
import { const_data, const_value, primitive_type, autoParenter } from "./helpers.js";

export class Constant extends Base {
  /**
   * @param {import("../tokeniser.js").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const tokens = {};
    tokens.base = tokeniser.consume("const");
    if (!tokens.base) {
      return;
    }
    let idlType = primitive_type(tokeniser);
    if (!idlType) {
      const base = tokeniser.consume("identifier") || tokeniser.error("Const lacks a type");
      idlType = new Type({ source: tokeniser.source, tokens: { base } });
    }
    if (tokeniser.probe("?")) {
      tokeniser.error("Unexpected nullable constant type");
    }
    idlType.type = "const-type";
    tokens.name = tokeniser.consume("identifier") || tokeniser.error("Const lacks a name");
    tokens.assign = tokeniser.consume("=") || tokeniser.error("Const lacks value assignment");
    tokens.value = const_value(tokeniser) || tokeniser.error("Const lacks a value");
    tokens.termination = tokeniser.consume(";") || tokeniser.error("Unterminated const, expected `;`");
    const ret = new Constant({ source: tokeniser.source, tokens });
    autoParenter(ret).idlType = idlType;
    return ret;
  }

  get type() {
    return "const";
  }
  get name() {
    return unescape(this.tokens.name.value);
  }
  get value() {
    return const_data(this.tokens.value);
  }
}
