// NOTES:
//  - the errors actually still need to be reviewed to check that they
//    are fully correct interpretations of the IDLs

"use strict";

const { collect } = require("./util/collect");
const expect = require("expect");

describe("Parses all of the invalid IDLs to check that they blow up correctly", () => {
  for (const test of collect("invalid", { expectError: true, raw: true })) {
    it(`should produce the right error for ${test.path}`, () => {
      const err = test.readText();
      if (test.error) {
        expect(test.error.message + "\n").toEqual(err);
      } else if (test.validation) {
        expect(test.validation.join("\n") + "\n").toEqual(err);
      } else {
        throw new Error("This test unexpectedly had no error");
      }
    });
  }
});
