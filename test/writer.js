"use strict";

const { collect } = require("./util/collect");
const wp = require("..");
const expect = require("expect");

function flatten(array) {
  return [].concat(...array.map(item => Array.isArray(item) ? flatten(item) : item));
}

function stringify(object) {
  if (object.stringify) {
    return object.stringify();
  }
  return object;
}

const templates = {
  wrap: items => flatten(items),
  trivia: t => [t],
  name: t => [t],
  reference: t => [t],
  type: c => [c],
  valueLiteral: c => [c],
  inheritance: c => [c],
  definition(contents, { data }) { 
    return Object.assign({
      stringify: () => contents.map(stringify).join("")
    }, data);
  },
  extendedAttribute: contents => contents.join(""),
  extendedAttributeReference: t => [t]
};

describe("Rewrite and parses all of the IDLs to produce the same ASTs", () => {
  for (const test of collect("syntax")) {
    it(`should produce the same AST for ${test.path}`, () => {
      const rewritten = wp.write(test.ast);
      expect(rewritten).toEqual(test.text);
      const diff = test.diff(wp.parse(rewritten, test.opt));
      expect(diff).toBe(undefined);
    });

    it(`should produce the same AST for ${test.path} with custom templates`, () => {
      // writer magically returns cloned AST objects with `stringify()` methods attached
      const rewritten = wp.write(test.ast, { templates });
      // compare stringified values
      expect(rewritten.map(stringify).join("")).toEqual(test.text);
      // compare AST object structure without the last EOF trivia
      // strip stringify() first by JSON parser
      const stripped = JSON.parse(JSON.stringify(rewritten));
      expect(stripped.slice(0, -1)).toEqual(test.ast.slice(0, -1));
      // compare flattened EOF trivia
      expect(stripped[stripped.length - 1]).toEqual(test.ast[test.ast.length - 1].trivia);
    });
  }
});
