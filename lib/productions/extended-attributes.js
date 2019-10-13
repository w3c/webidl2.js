import { Base } from "./base.js";
import { ArrayBase } from "./array-base.js";
import { Token } from "./token.js";
import { list, argument_list, autoParenter } from "./helpers.js";
import { validationError } from "../error.js";

/**
 * @param {import("../tokeniser").Tokeniser} tokeniser
 * @param {string} tokenName
 */
function tokens(tokeniser, tokenName) {
  const toks = list(tokeniser, {
    parser: Token.parser(tokeniser, tokenName),
    listName: tokenName + " list"
  });
  return toks;
}

// This will allow a set of strings to be parsed
function identifiersOrStrings(tokeniser) {
  let toks = tokens(tokeniser, "identifier");
  if (toks.length) {
    return toks;
  }
  toks = tokens(tokeniser, "string");
  if (toks.length) {
    return toks;
  }
  tokeniser.error(`Expected identifiers or strings but none found`);
}


class ExtendedAttributeParameters extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const tokens = { assign: tokeniser.consume("=") };
    const ret = autoParenter(new ExtendedAttributeParameters({ source: tokeniser.source, tokens }));
    if (tokens.assign) {
      tokens.secondaryName = tokeniser.consume("identifier", "decimal", "integer", "string");
    }
    tokens.open = tokeniser.consume("(");
    if (tokens.open) {
      ret.list = ret.rhsType === "identifier-list" ?
        // [Exposed=(Window,Worker)]
        identifiersOrStrings(tokeniser) :
        // [NamedConstructor=Audio(DOMString src)] or [Constructor(DOMString str)]
        argument_list(tokeniser);
      tokens.close = tokeniser.consume(")") || tokeniser.error("Unexpected token in extended attribute argument list");
    } else if (ret.hasRhs && !tokens.secondaryName) {
      tokeniser.error("No right hand side to extended attribute assignment");
    }
    return ret.this;
  }

  get rhsType() {
    return !this.tokens.assign ? null :
      !this.tokens.secondaryName ? "identifier-list" :
        this.tokens.secondaryName.type;
  }
}

export class SimpleExtendedAttribute extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser) {
    const name = tokeniser.consume("identifier");
    if (name) {
      return new SimpleExtendedAttribute({
        source: tokeniser.source,
        tokens: { name },
        params: ExtendedAttributeParameters.parse(tokeniser)
      });
    }
  }

  constructor({ source, tokens, params }) {
    super({ source, tokens });
    params.parent = this;
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

  *validate(defs) {
    if (this.name === "NoInterfaceObject") {
      const message = `\`[NoInterfaceObject]\` extended attribute is an \
undesirable feature that may be removed from Web IDL in the future. Refer to the \
[relevant upstream PR](https://github.com/heycam/webidl/pull/609) for more \
information.`;
      yield validationError(this.tokens.name, this, "no-nointerfaceobject", message, { level: "warning" });
    }
    for (const arg of this.arguments) {
      yield* arg.validate(defs);
    }
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
    if (!tokens.open) return new ExtendedAttributes({});
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

  *validate(defs) {
    for (const extAttr of this) {
      yield* extAttr.validate(defs);
    }
  }
}
