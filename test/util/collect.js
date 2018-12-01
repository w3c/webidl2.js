"use strict";

const wp = require("../../lib/webidl2");
const pth = require("path");
const fs = require("fs");
const jdp = require("jsondiffpatch");

/**
 * Collects test items from the specified directory
 * @param {string} base
 */
function* collect(base, { expectError } = {}) {
  base = pth.join(__dirname, "..", base);
  const dir = pth.join(base, "idl");
  const idls = fs.readdirSync(dir)
    .filter(it => (/\.widl$/).test(it))
    .map(it => pth.join(dir, it));

  for (const path of idls) {
    try {
      const text = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      const ast = wp.parse(text);
      yield new TestItem({ text, ast, path });
    }
    catch (error) {
      if (expectError) {
        yield new TestItem({ path, error });
      }
      else {
        throw error;
      }
    }
  }
};


class TestItem {
  constructor({ text, ast, path, error }) {
    this.text = text;
    this.ast = ast;
    this.path = path;
    this.error = error;
    this.jsonPath = pth.join(pth.dirname(path), "../json", pth.basename(path).replace(".widl", ".json"));
  }

  readJSON() {
    return JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
  }

  diff(target = this.readJSON()) {
    return jdp.diff(target, this.ast);
  }
}

module.exports.collect = collect;
