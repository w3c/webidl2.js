import { collect } from "./util/collect.js";
import expect from "expect";
import { Attribute } from "../lib/productions/attribute.js";

const extensions = {
  "callback-interface": {
    extMembers: [[Attribute.parse]],
  },
  namespace: {
    extMembers: [[Attribute.parse, { readonly: false }]],
  },
};

describe("Parses all of the IDLs that require extensions", () => {
  for (const test of collect("extensions", { extensions })) {
    it(`should produce the same AST for ${test.path}`, () => {
      expect(test.diff()).toBeFalsy();
    });
  }
});
