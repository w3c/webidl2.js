"use strict";

const { collect } = require("./util/collect");
const expect = require("expect");
const webidl2 = require("../dist/webidl2");

describe("Parses all of the IDLs to produce the correct ASTs", () => {
  for (const test of collect("syntax")) {
    it(`should produce the same AST for ${test.path}`, () => {
      expect(test.diff()).toBeFalsy();
    });
  }
});

describe("Options", () => {
  it("should emit EOF if concrete", () => {
    const parsed = webidl2.parse("", { concrete: true });
    expect(parsed.length).toBe(1);
    expect(parsed[0].type).toBe("eof");
  });

  it("should not emit EOF if not concrete", () => {
    const parsed = webidl2.parse("");
    expect(parsed.length).toBe(0);
  });
});
