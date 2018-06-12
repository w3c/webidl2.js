"use strict";

const { collect } = require("./util/collect");
const wp = require("../lib/webidl2");
const writer = require("../lib/writer");
const expect = require("expect");
const path = require("path");

describe("Rewrite and parses all of the IDLs to produce the same ASTs", () => {
  const whitelist = [
    "documentation",
    "documentation-dos"
  ];
  for (const test of collect("syntax")) {
    it(`should produce the same AST for ${test.path}`, () => {
      const rewritten = writer.write(test.ast);
      if (whitelist.includes(path.basename(test.path).slice(0, -5))) {
        expect(rewritten).toEqual(test.text.trim());
      }
      const diff = test.diff(wp.parse(rewritten, test.opt));
      expect(diff).toBe(undefined);
    });
  }
});
