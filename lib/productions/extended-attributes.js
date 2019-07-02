import { Base } from "./base.js";
import { ArrayBase } from "./array-base.js";
import { list, identifiers, argument_list } from "./helpers.js";

class ExtendedAttributeParameters extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const tokens = { assign: tokeniser.consume("=") };
    const ret = new ExtendedAttributeParameters({ source: tokeniser.source, tokens });
    if (tokens.assign) {
      tokens.secondaryName = tokeniser.consume("identifier", "decimal", "integer", "string");
    }
    tokens.open = tokeniser.consume("(");
    if (tokens.open) {
      ret.list = ret.rhsType === "identifier-list" ?
        // [Exposed=(Window,Worker)]
        identifiers(tokeniser) :
        // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
        argument_list(tokeniser);
      tokens.close = tokeniser.consume(")") || tokeniser.error("Unexpected token in extended attribute argument list");
    } else if (ret.hasRhs && !tokens.secondaryName) {
      tokeniser.error("No right hand side to extended attribute assignment");
    }
    return ret;
  }

  get rhsType() {
    return !this.tokens.assign ? null :
      !this.tokens.secondaryName ? "identifier-list" :
        this.tokens.secondaryName.type;
  }
}

class SimpleExtendedAttribute extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const name = tokeniser.consume("identifier");
    if (name) {
      return new SimpleExtendedAttribute({
        tokens: { name },
        params: ExtendedAttributeParameters.parse(tokeniser)
      });
    }
  }

  constructor({ source, tokens, params }) {
    super({ source, tokens });
    Object.defineProperty(this, "params", { value: params });
  }

  get type() {
    return "extended-attribute";
  }
  get name() {
    return this.tokens.name.value;
  }
  get rhs() {
    const { rhsType: type, tokens, list } = this.params;
    if (!type) {
      return null;
    }
    const value = type === "identifier-list" ? list : tokens.secondaryName.value;
    return { type, value };
  }
  get arguments() {
    const { rhsType, list } = this.params;
    if (!list || rhsType === "identifier-list") {
      return [];
    }
    return list;
  }
}

// Note: we parse something simpler than the official syntax. It's all that ever
// seems to be used
export class ExtendedAttributes extends ArrayBase {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const tokens = {};
    tokens.open = tokeniser.consume("[");
    if (!tokens.open) return [];
    const ret = new ExtendedAttributes({ source: tokeniser.source, tokens });
    ret.push(...list(tokeniser, {
      parser: SimpleExtendedAttribute.parse,
      listName: "extended attribute"
    }));
    tokens.close = tokeniser.consume("]") || tokeniser.error("Unexpected closing token of extended attribute");
    if (!ret.length) {
      tokeniser.error("Found an empty extended attribute");
    }
    if (tokeniser.probe("[")) {
      tokeniser.error("Illegal double extended attribute lists, consider merging them");
    }
    return ret;
  }
}
