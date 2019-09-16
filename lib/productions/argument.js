import { Base } from "./base.js";
import { Default } from "./default.js";
import { ExtendedAttributes } from "./extended-attributes.js";
import { unescape, type_with_extended_attributes } from "./helpers.js";
import { argumentNameKeywords, Tokeniser } from "../tokeniser.js";
import { validationError } from "../error.js";
import { idlTypeIncludesDictionary } from "../validators/helpers.js";

export class Argument extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const start_position = tokeniser.position;
    const tokens = {};
    const ret = new Argument({ source: tokeniser.source, tokens });
    ret.extAttrs = ExtendedAttributes.parse(tokeniser);
    tokens.optional = tokeniser.consume("optional");
    ret.idlType = type_with_extended_attributes(tokeniser, "argument-type");
    if (!ret.idlType) {
      return tokeniser.unconsume(start_position);
    }
    if (!tokens.optional) {
      tokens.variadic = tokeniser.consume("...");
    }
    tokens.name = tokeniser.consume("identifier", ...argumentNameKeywords);
    if (!tokens.name) {
      return tokeniser.unconsume(start_position);
    }
    ret.default = tokens.optional ? Default.parse(tokeniser) : null;
    return ret;
  }

  get type() {
    return "argument";
  }
  get optional() {
    return !!this.tokens.optional;
  }
  get variadic() {
    return !!this.tokens.variadic;
  }
  get name() {
    return unescape(this.tokens.name.value);
  }

  *validate(defs) {
    yield* this.idlType.validate(defs);
    if (idlTypeIncludesDictionary(this.idlType, defs, { useNullableInner: true })) {
      if (this.idlType.nullable) {
        const message = `Dictionary arguments cannot be nullable.`;
        yield validationError(this.tokens.name, this, "no-nullable-dict-arg", message);
      } else if (this.optional && !this.default) {
        const message = `Optional dictionary arguments must have a default value of \`{}\`.`;
        yield validationError(this.tokens.name, this, "dict-arg-default", message, {
          autofix: autofixOptionalDictionaryDefaultValue(this)
        });
      }
    }
  }
}

/**
 * @param {Argument} arg
 */
function autofixOptionalDictionaryDefaultValue(arg) {
  return () => {
    arg.default = Default.parse(new Tokeniser(" = {}"));
  };
}
