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

    const input1space = `
      [Exposed=Window, Constructor]
      interface C {
       // less indentation
       attribute any koala;
      };
    `;
    const output1space = `
      [Exposed=Window]
      interface C {
       constructor();
       // less indentation
       attribute any koala;
      };
    `;
    expect(autofix(input1space)).toBe(output1space);

    const inputTab = `
      [Exposed=Window, Constructor]
      interface C {
      \t// tabbed indentation
      \tattribute any koala;
      };
    `;
    const outputTab = `
      [Exposed=Window]
      interface C {
      \tconstructor();
      \t// tabbed indentation
      \tattribute any koala;
      };
    `;
    expect(autofix(inputTab)).toBe(outputTab);

    const inputTabOp = `
      [Exposed=Window, Constructor]
      interface C {
      \t// tabbed indentation
      \tvoid koala();
      };
    `;
    const outputTabOp = `
      [Exposed=Window]
      interface C {
      \tconstructor();
      \t// tabbed indentation
      \tvoid koala();
      };
    `;
    expect(autofix(inputTabOp)).toBe(outputTabOp);

    const inputTabSpecialOp = `
      [Exposed=Window, Constructor]
      interface C {
      \t// tabbed indentation
      \tstatic void koala();
      };
    `;
    const outputTabSpecialOp = `
      [Exposed=Window]
      interface C {
      \tconstructor();
      \t// tabbed indentation
      \tstatic void koala();
      };
    `;
    expect(autofix(inputTabSpecialOp)).toBe(outputTabSpecialOp);

    const inputMixedIndent = `
      [Exposed=Window, Constructor]
      interface C {
        attribute any koala;
          attribute any elephant;
      };
    `;
    const outputMixedIndent = `
      [Exposed=Window]
      interface C {
        constructor();
        attribute any koala;
          attribute any elephant;
      };
    `;
    expect(autofix(inputMixedIndent)).toBe(outputMixedIndent);

    const inputMultiple = `
      [Exposed=Window, Constructor, Constructor(any chocolate)]
      interface C {
        attribute any koala;
      };
    `;
    const outputMultiple = `
      [Exposed=Window]
      interface C {
        constructor();
        constructor(any chocolate);
        attribute any koala;
      };
    `;
    expect(autofix(inputMultiple)).toBe(outputMultiple);
  });
});
