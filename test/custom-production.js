import expect from "expect";

import { parse, write } from "webidl2";
import { Base } from "../lib/productions/base.js";
import {
  autoParenter,
  type_with_extended_attributes,
} from "../lib/productions/helpers.js";

class CustomAttribute extends Base {
  static parse(tokeniser) {
    const start_position = tokeniser.position;
    const tokens = {};
    const ret = autoParenter(
      new CustomAttribute({ source: tokeniser.source, tokens })
    );
    tokens.base = tokeniser.consumeIdentifier("custom");
    if (!tokens.base) {
      tokeniser.unconsume(start_position);
      return;
    }
    ret.idlType =
      type_with_extended_attributes(tokeniser, "attribute-type") ||
      tokeniser.error("Attribute lacks a type");
    tokens.name =
      tokeniser.consumeKind("identifier") ||
      tokeniser.error("Attribute lacks a name");
    tokens.termination =
      tokeniser.consume(";") ||
      tokeniser.error("Unterminated attribute, expected `;`");
    return ret.this;
  }

  get type() {
    return "custom attribute";
  }

  write(w) {
    const { parent } = this;
    return w.ts.definition(
      w.ts.wrap([
        this.extAttrs.write(w),
        w.token(this.tokens.base),
        w.ts.type(this.idlType.write(w)),
        w.name_token(this.tokens.name, { data: this, parent }),
        w.token(this.tokens.termination),
      ]),
      { data: this, parent }
    );
  }
}

describe("Parse IDLs using custom productions", () => {
  it("Parse and rewrite top-level custom attribute", () => {
    const customIdl = "custom long bar;";
    const result = parse(customIdl, {
      productions: [CustomAttribute.parse],
      concrete: true,
    });
    expect(result[0].type).toBe("custom attribute");

    const rewritten = write(result);
    expect(rewritten).toBe(customIdl);
  });
});

describe("Parse IDLs using custom extensions", () => {
  [
    ["callback interface", "callbackInterface"],
    ["dictionary", "dictionary"],
    ["interface", "interface"],
    ["interface mixin", "mixin"],
    ["namespace", "namespace"],
  ].forEach(([type, key]) => {
    it(`Attribute on ${type}`, () => {
      const customIdl = `${type} Foo {
        custom long bar;
      };`;
      const result = parse(customIdl, {
        concrete: true,
        extensions: { [key]: { extMembers: [[CustomAttribute.parse]] } },
      });
      expect(result[0].type).toBe(type);
      expect(result[0].members[0].type).toBe("custom attribute");
    });
  });
});
