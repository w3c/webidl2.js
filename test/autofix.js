"use strict";

const expect = require("expect");
const webidl2 = require("../dist/webidl2.js");

describe("Writer template functions", () => {
  function autofix(idl) {
    const ast = webidl2.parse(idl, { concrete: true });
    const validations = webidl2.validate(ast);
    for (const v of validations) {
      if (v.autofix) {
        v.autofix();
      }
    }
    return webidl2.write(ast);
  }

  it("should add `= {}`", () => {
    const input = `
      dictionary A {};
      [Exposed=Window]
      interface B {
        void op(optional A a);
      };
    `;
    const output = `
      dictionary A {};
      [Exposed=Window]
      interface B {
        void op(optional A a = {});
      };
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `[Exposed=Window]` for interfaces without extAttrs", () => {
    const input = `
      // hello
      interface B {};
    `;
    const output = `
      // hello
      [Exposed=Window]
      interface B {};
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `[Exposed=Window]` for interfaces with extAttrs", () => {
    const input = `
      [SecureContext]
      interface B {};
    `;
    const output = `
      [Exposed=Window, SecureContext]
      interface B {};
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `[Exposed=Window]` for interfaces with spaced extAttrs", () => {
    const input = `
      [ /* something */ SecureContext]
      interface B {};
    `;
    const output = `
      [Exposed=Window, /* something */ SecureContext]
      interface B {};
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `[Exposed=Window]` for namespaces without extAttrs", () => {
    const input = `
      // hello
      namespace B {};
    `;
    const output = `
      // hello
      [Exposed=Window]
      namespace B {};
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `[Exposed=Window]` for namespaces with extAttrs", () => {
    const input = `
      [SecureContext]
      namespace B {};
    `;
    const output = `
      [Exposed=Window, SecureContext]
      namespace B {};
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `[Exposed=Window]` for namespaces with spaced extAttrs", () => {
    const input = `
      [ /* something */ SecureContext]
      namespace B {};
    `;
    const output = `
      [Exposed=Window, /* something */ SecureContext]
      namespace B {};
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should add `constructor()` for interfaces with [Constructor]", () => {
    const input = `
      [SecureContext, // secure context
       Constructor(object arg),
       Exposed=Window]
      interface B {
        attribute any attr;
        // attribute any popipa;
      };
    `;
    const output = `
      [SecureContext, // secure context
       Exposed=Window]
      interface B {
        constructor(object arg);
        attribute any attr;
        // attribute any popipa;
      };
    `;
    expect(autofix(input)).toBe(output);

    const inputEmpty = `
      [Exposed=Window, Constructor]
      interface C {};
    `;
    const outputEmpty = `
      [Exposed=Window]
      interface C {
        constructor();
      };
    `;
    expect(autofix(inputEmpty)).toBe(outputEmpty);

    const input4space = `
      [Exposed=Window, Constructor]
      interface C {
          // more indentation
          attribute any koala;
      };
    `;
    const output4space = `
      [Exposed=Window]
      interface C {
          constructor();
          // more indentation
          attribute any koala;
      };
    `;
    expect(autofix(input4space)).toBe(output4space);
  });
});
