// NOTES:
//  - the errors actually still need to be reviewed to check that they
//    are fully correct interpretations of the IDLs

"use strict";

const wp = require("../lib/webidl2");
const expect = require("expect");
const pth = require("path");
const fs = require("fs");

describe("Parses all of the invalid IDLs to check that they blow up correctly", () => {
  const dir = pth.join(__dirname, "invalid/idl");
  const skip = {};
  const idls = fs.readdirSync(dir)
    .filter(it => (/\.w?idl$/).test(it) && !skip[it])
    .map(it => pth.join(dir, it));

  for (const idl of idls) {
    const err = JSON.parse(fs.readFileSync(
      pth.join(__dirname, "invalid", "json", pth.basename(idl).replace(/\.w?idl/, ".json")),
      "utf8"
    ));

    it(`should produce the right error for ${idl}`, () => {
      let error;
      try {
        const ast = wp.parse(fs.readFileSync(idl, "utf8"));
        console.log(JSON.stringify(ast, null, 4));
      }
      catch (e) {
        error = e;
      }
      finally {
        expect(error).toBeTruthy();
        expect(error.message).toEqual(err.message);
        expect(error.line).toEqual(err.line);
      }
    });
  }
});
