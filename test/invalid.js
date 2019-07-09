// NOTES:
//  - the errors actually still need to be reviewed to check that they
//    are fully correct interpretations of the IDLs

"use strict";

const { collect } = require("./util/collect");
const { parse, validate } = require("..");
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

describe("Error object structure", () => {
  it("should named WebIDLParseError", () => {
    try {
      parse("typedef unrestricted\n\n\n3.14 X;");
      throw new Error("Shouldn't reach here");
    } catch ({ name }) {
      expect(name).toBe("WebIDLParseError");
    }
  });

  it("should contain error line field", () => {
    try {
      parse("typedef unrestricted\n\n\n3.14 X;");
      throw new Error("Shouldn't reach here");
    } catch ({ line }) {
      expect(line).toBe(4);
    }
  });

  it("should contain input field", () => {
    try {
      parse("couldn't read any token");
      throw new Error("Shouldn't reach here");
    } catch ({ input }) {
      expect(input).toBe("couldn't read any");
    }
  });

  it("should contain tokens field", () => {
    try {
      parse("cannot find any valid definitions");
      throw new Error("Shouldn't reach here");
    } catch ({ tokens }) {
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe("identifier");
      expect(tokens[0].value).toBe("cannot");
    }
  });

  it("should contain fileName field when specified", () => {
    const cat = "cat.webidl";
    try {
      parse("how's your cat nowadays", { fileName: cat });
      throw new Error("Shouldn't reach here");
    } catch ({ fileName, message }) {
      expect(fileName).toBe(cat);
      expect(message).toContain(` in ${cat}`);
    }
  });

  it("should not contain fileName field if nonexistent", () => {
    try {
      parse("Answer to the Ultimate Question of Life, the Universe, and Everything");
      throw new Error("Shouldn't reach here");
    } catch ({ fileName, message }) {
      expect(fileName).toBeUndefined();
      expect(message).not.toContain(` in undefined`);
    }
  });

  it("should contain correct fileName field for validation position", () => {
    const x = parse("dictionary X {};", { fileName: "dict.webidl" });
    const y = parse("interface Y { void y(optional X x); };", { fileName: "interface.webidl" });
    const validation = validate([x, y]);
    expect(validation[0]).toContain("interface.webidl");
  });
});

describe("Validation", () => {
  it("should supprt array of ASTs", () => {
    const x = parse("interface X {};");
    const y = parse("interface Y {};");
    const validationX = validate(x);
    const validationY = validate(y);
    const validations = validate([x, y]);
    expect(validationX.length).toBe(1);
    expect(validationY.length).toBe(1);
    expect(validations.length).toBe(2);
  });
});
