import { Base } from "./base.js";
import { unescape, type_with_extended_attributes, return_type, primitive_type } from "./helpers.js";
import { stringTypes } from "../tokeniser.js";
import { validationError } from "../error.js";
import { idlTypeIncludesDictionary } from "../validators/helpers.js";

/**
 * @param {import("../tokeniser").Tokeniser} tokeniser
 * @param {string} typeName
 */
function generic_type(tokeniser, typeName) {
  const base = tokeniser.consume("FrozenArray", "Promise", "sequence", "record");
  if (!base) {
    return;
  }
  const ret = new Type({ source: tokeniser.source, tokens: { base } });
  ret.tokens.open = tokeniser.consume("<") || tokeniser.error(`No opening bracket after ${base.type}`);
  switch (base.type) {
    case "Promise": {
      if (tokeniser.probe("[")) tokeniser.error("Promise type cannot have extended attribute");
      const subtype = return_type(tokeniser, typeName) || tokeniser.error("Missing Promise subtype");
      ret.subtype.push(subtype);
      break;
    }
    case "sequence":
    case "FrozenArray": {
      const subtype = type_with_extended_attributes(tokeniser, typeName) || tokeniser.error(`Missing ${base.type} subtype`);
      ret.subtype.push(subtype);
      break;
    }
    case "record": {
      if (tokeniser.probe("[")) tokeniser.error("Record key cannot have extended attribute");
      const keyType = tokeniser.consume(...stringTypes) || tokeniser.error(`Record key must be one of: ${stringTypes.join(", ")}`);
      const keyIdlType = new Type({ source: tokeniser.source, tokens: { base: keyType }});
      keyIdlType.tokens.separator = tokeniser.consume(",") || tokeniser.error("Missing comma after record key type");
      keyIdlType.type = typeName;
      const valueType = type_with_extended_attributes(tokeniser, typeName) || tokeniser.error("Error parsing generic type record");
      ret.subtype.push(keyIdlType, valueType);
      break;
    }
  }
  if (!ret.idlType) tokeniser.error(`Error parsing generic type ${base.type}`);
  ret.tokens.close = tokeniser.consume(">") || tokeniser.error(`Missing closing bracket after ${base.type}`);
  return ret;
}

/**
 * @param {import("../tokeniser").Tokeniser} tokeniser
 */
function type_suffix(tokeniser, obj) {
  const nullable = tokeniser.consume("?");
  if (nullable) {
    obj.tokens.nullable = nullable;
  }
  if (tokeniser.probe("?")) tokeniser.error("Can't nullable more than once");
}

/**
 * @param {import("../tokeniser").Tokeniser} tokeniser
 * @param {string} typeName
 */
function single_type(tokeniser, typeName) {
  let ret = generic_type(tokeniser, typeName) || primitive_type(tokeniser);
  if (!ret) {
    const base = tokeniser.consume("identifier", "scopedidentifier", ...stringTypes);
    if (!base) {
      return;
    }
    ret = new Type({ source: tokeniser.source, tokens: { base } });
    if (tokeniser.probe("<")) tokeniser.error(`Unsupported generic type ${base.value}`);
  }
  if (ret.generic === "Promise" && tokeniser.probe("?")) {
    tokeniser.error("Promise type cannot be nullable");
  }
  ret.type = typeName || null;
  type_suffix(tokeniser, ret);
  if (ret.nullable && ret.idlType === "any") tokeniser.error("Type `any` cannot be made nullable");
  return ret;
}

/**
 * @param {import("../tokeniser").Tokeniser} tokeniser
 * @param {string} type
 */
function union_type(tokeniser, type) {
  const tokens = {};
  tokens.open = tokeniser.consume("(");
  if (!tokens.open) return;
  const ret = new Type({ source: tokeniser.source, tokens });
  ret.type = type || null;
  while (true) {
    const typ = type_with_extended_attributes(tokeniser) || tokeniser.error("No type after open parenthesis or 'or' in union type");
    if (typ.idlType === "any") tokeniser.error("Type `any` cannot be included in a union type");
    ret.subtype.push(typ);
    const or = tokeniser.consume("or");
    if (or) {
      typ.tokens.separator = or;
    }
    else break;
  }
  if (ret.idlType.length < 2) {
    tokeniser.error("At least two types are expected in a union type but found less");
  }
  tokens.close = tokeniser.consume(")") || tokeniser.error("Unterminated union type");
  type_suffix(tokeniser, ret);
  return ret;
}

export class Type extends Base {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   * @param {string} typeName
   */
  static parse(tokeniser, typeName) {
    return single_type(tokeniser, typeName) || union_type(tokeniser, typeName);
  }

  constructor({ source, tokens }) {
    super({ source, tokens });
    Object.defineProperty(this, "subtype", { value: [] });
    this.extAttrs = [];
  }

  get generic() {
    if (this.subtype.length && this.tokens.base) {
      return this.tokens.base.value;
    }
    return "";
  }
  get nullable() {
    return Boolean(this.tokens.nullable);
  }
  get union() {
    return Boolean(this.subtype.length) && !this.tokens.base;
  }
  get idlType() {
    if (this.subtype.length) {
      return this.subtype;
    }
    // Adding prefixes/postfixes for "unrestricted float", etc.
    const name = [
      this.tokens.prefix,
      this.tokens.base,
      this.tokens.postfix
    ].filter(t => t).map(t => t.value).join(" ");
    return unescape(name);
  }

  *validate(defs) {
    /*
     * If a union is nullable, its subunions cannot include a dictionary
     * If not, subunions may include dictionaries if each union is not nullable
     */
    const typedef = !this.union && defs.unique.get(this.idlType);
    const target =
      this.union ? this :
      (typedef && typedef.type === "typedef") ? typedef.idlType :
      undefined;
    if (target && this.nullable) {
      // do not allow any dictionary
      const reference = idlTypeIncludesDictionary(target, defs);
      if (reference) {
        const targetToken = (this.union ? reference : this).tokens.base;
        const message = `Nullable union cannot include a dictionary type`;
        yield validationError(this.source, targetToken, this, message);
      }
    } else {
      // allow some dictionary
      for (const subtype of this.subtype) {
        yield* subtype.validate(defs);
      }
    }
  }
}
