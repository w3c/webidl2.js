"use strict";
import expect from "expect";

import { Attribute } from "../lib/productions/attribute.js";
import { parse } from "../lib/webidl2.js";
import { IterableLike } from "../lib/productions/iterable.js";

describe("Parse IDLs using custom extensions", () => {
  ["callback interface", "dictionary"].forEach((type) => {
    it(`Attribute on ${type}`, () => {
      const customIdl = `${type} Foo {
        attribute long bar;
      };`;

      // Convert to camel case
      const key = type.replace(/ (.)/g, (m, c) => c.toUpperCase());
      const result = parse(customIdl, {
        concrete: true,
        extensions: { [key]: { extMembers: [[Attribute.parse]] } },
      });
      expect(result[0].type).toBe(type);
      expect(result[0].members[0].type).toBe("attribute");
    });
  });

  it("Attribute (writable) on namespace", () => {
    const customIdl = `namespace Foo {
        attribute long bar;
      };`;
    const result = parse(customIdl, {
      concrete: true,
      extensions: { namespace: { extMembers: [[Attribute.parse]] } },
    });
    expect(result[0].type).toBe("namespace");
    expect(result[0].members[0].type).toBe("attribute");
    expect(result[0].members[0].readonly).toBe(false);
  });

  it("Map-like on mixin", () => {
    const customIdl = `interface mixin Foo {
        readonly maplike<DOMString, unsigned long long>;
      };`;
    const result = parse(customIdl, {
      concrete: true,
      extensions: { mixin: { extMembers: [[IterableLike.parse]] } },
    });
    expect(result[0].type).toBe("interface mixin");
    expect(result[0].members[0].type).toBe("maplike");
  });
});
