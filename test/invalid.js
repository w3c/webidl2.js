// NOTES:
//  - the errors actually still need to be reviewed to check that they
//    are fully correct interpretations of the IDLs

import { collect } from "./util/collect.js";
import { parse, validate, WebIDLParseError } from "webidl2";
import expect from "expect";

describe("Parses all of the invalid IDLs to check that they blow up correctly", () => {
  for (const test of collect("invalid", { expectError: true, raw: true })) {
    it(`should produce the right error for ${test.path}`, () => {
      const err = test.readText();
      if (test.error) {
        expect(test.error.message + "\n").toBe(err);
      } else if (test.validation) {
        const messages = test.validation
          .map((v) => `(${v.ruleName}) ${v.message}`)
          .join("\n");
        expect(messages + "\n").toBe(err);
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

  it("should contain sourceName field when specified", () => {
    const cat = "cat.webidl";
    try {
      parse("how's your cat nowadays", { sourceName: cat });
      throw new Error("Shouldn't reach here");
    } catch ({ sourceName, message }) {
      expect(sourceName).toBe(cat);
      expect(message).toContain(` in ${cat}`);
    }
  });

  it("should not contain sourceName field if nonexistent", () => {
    try {
      parse(
        "Answer to the Ultimate Question of Life, the Universe, and Everything"
      );
      throw new Error("Shouldn't reach here");
    } catch ({ sourceName, message }) {
      expect(sourceName).toBeUndefined();
      expect(message).not.toContain(` in undefined`);
    }
  });

  it("should contain correct sourceName field for validation position", () => {
    const x = parse("dictionary X {};");
    const y = parse("interface Y { void y(optional X x); };", {
      sourceName: "interface.webidl",
    });
    const validation = validate([x, y]);
    expect(validation[0].line).toBe(1);
    expect(validation[0].sourceName).toBe("interface.webidl");
    expect(validation[0].message).toContain("interface.webidl");
  });

  it("should respect falsy source names", () => {
    const x = parse("interface X {};", { sourceName: 0 });
    const validation = validate(x);
    expect(validation[0].sourceName).toBe(0);
  });

  it("should contain bareMessage field", () => {
    const x = parse("interface X {};");
    const validation = validate(x);
    const { bareMessage, message } = validation[0];
    expect(bareMessage).toContain("Exposed");
    expect(message.endsWith(bareMessage)).toBe(true);
  });

  it("should contain context field", () => {
    const x = parse("interface X {};", { sourceName: "Biblia" });
    const validation = validate(x);
    const { context, message } = validation[0];
    expect(context).toContain("Biblia");
    expect(context.endsWith("^")).toBe(true);
    expect(message.startsWith(context)).toBe(true);
  });

  it("should mark severity as normal", () => {
    const x = parse("interface X {};");
    const validation = validate(x);
    const { level } = validation[0];
    expect(level).toBe("error");
  });

  it("should mark severity as weak", () => {
    const x = parse("[NoInterfaceObject] interface X {};");
    const validation = validate(x);
    const { level } = validation[0];
    expect(level).toBe("warning");
  });

  it("allows `instanceof WebIDLParseError`", () => {
    try {
      parse("throwerror");
      throw new Error("Shouldn't reach here");
    } catch (err) {
      expect(err).toBeInstanceOf(WebIDLParseError);
      expect(err.constructor.name).toBe("WebIDLParseError");
    }
  });
});

describe("Validation", () => {
  it("should support array of ASTs", () => {
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
