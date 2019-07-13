import { Base } from "./base.js";
import { unescape, type_with_extended_attributes } from "./helpers.js";
import { ExtendedAttributes } from "./extended-attributes.js";
import { Default } from "./default.js";

export class Field extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const tokens = {};
    const ret = new Field({ source: tokeniser.source, tokens });
    ret.extAttrs = ExtendedAttributes.parse(tokeniser);
    tokens.required = tokeniser.consume("required");
    ret.idlType = type_with_extended_attributes(tokeniser, "dictionary-type") || tokeniser.error("Dictionary member lacks a type");
    tokens.name = tokeniser.consume("identifier") || tokeniser.error("Dictionary member lacks a name");
    ret.default = Default.parse(tokeniser);
    if (tokens.required && ret.default) tokeniser.error("Required member must not have a default");
    tokens.termination = tokeniser.consume(";") || tokeniser.error("Unterminated dictionary member, expected `;`");
    return ret;
  }

  get type() {
    return "field";
  }
  get name() {
    return unescape(this.tokens.name.value);
  }
  get required() {
    return !!this.tokens.required;
  }
}
