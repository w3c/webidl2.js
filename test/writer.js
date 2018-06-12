"use strict";

const { collect } = require("./util/collect");
const wp = require("../lib/webidl2");
const expect = require("expect");

describe("Rewrite and parses all of the IDLs to produce the same ASTs", () => {
  for (const test of collect("syntax")) {
    it(`should produce the same AST for ${test.path}`, () => {
      const rewritten = wp.write(test.ast);
      expect(rewritten).toEqual(test.text);
      const diff = test.diff(wp.parse(rewritten, test.opt));
      expect(diff).toBe(undefined);
    });
  }
});
