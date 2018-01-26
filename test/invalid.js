// NOTES:
//  - the errors actually still need to be reviewed to check that they
//    are fully correct interpretations of the IDLs

"use strict";

const { collect } = require("./util/collect");
const fs = require("fs");
const expect = require("expect");

describe("Parses all of the invalid IDLs to check that they blow up correctly", () => {
  for (const test of collect("invalid", true)) {
    it(`should produce the right error for ${test.path}`, () => {
      const err = JSON.parse(fs.readFileSync(test.jsonPath(), "utf8"));
      expect(test.error).toBeTruthy();
      expect(test.error.message).toEqual(err.message);
      expect(test.error.line).toEqual(err.line);
    });
  }
});
