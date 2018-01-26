"use strict";

const wp = require("../../lib/webidl2");
const pth = require("path");
const fs = require("fs");
const jdp = require("jsondiffpatch");

/**
 * Collects test items from the specified directory
 * @param {string} base
 * @param {boolean} [expectError]
 */
function* collect(base, expectError) {
  base = pth.join(__dirname, "..", base);
  const dir = pth.join(base, "idl");
  const idls = fs.readdirSync(dir)
    .filter(it => (/\.widl$/).test(it))
    .map(it => pth.join(dir, it));

  for (const idl of idls) {
    const optFile = pth.join(base, "opt", pth.basename(idl)).replace(".widl", ".json");
    let opt = undefined;
    if (fs.existsSync(optFile))
      opt = JSON.parse(fs.readFileSync(optFile, "utf8"));

    try {
      const result = wp.parse(fs.readFileSync(idl, "utf8").replace(/\r\n/g, "\n"), opt);
      yield createItem(result, idl);
    }
    catch (e) {
      if (expectError) {
        yield createItem(null, idl, e);
      }
      else {
        throw e;
      }
    }
  }
};

/**
 * Creates a test item object
 * @param {string} ast
 * @param {string} path
 * @param {Error} [error]
 */
function createItem(ast, path, error) {
  return {
    ast,
    path,
    error,
    jsonPath() {
      return pth.join(pth.dirname(this.path), "../json", pth.basename(this.path).replace(".widl", ".json"));
    },
    diff() {
      return jdp.diff(JSON.parse(fs.readFileSync(this.jsonPath(), "utf8")), ast);
    }
  }
}

module.exports.collect = collect;
