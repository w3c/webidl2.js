import expect from "expect";
import { parse, validate, write } from "webidl2";

describe("Writer template functions", () => {
  function autofix(idl) {
    const ast = parse(idl, { concrete: true });
    const validations = validate(ast);
    for (const v of validations) {
      if (v.autofix) {
        v.autofix();
      }
    }
    return write(ast);
  }

  it("should add `= {}`", () => {
    const input = `
      dictionary A {};
      [Exposed=Window]
      interface B {
        undefined op(optional A a);
      };
    `;
    const output = `
      dictionary A {};
      [Exposed=Window]
      interface B {
        undefined op(optional A a = {});
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
      \tundefined koala();
      };
    `;
    const outputTabOp = `
      [Exposed=Window]
      interface C {
      \tconstructor();
      \t// tabbed indentation
      \tundefined koala();
      };
    `;
    expect(autofix(inputTabOp)).toBe(outputTabOp);

    const inputTabSpecialOp = `
      [Exposed=Window, Constructor]
      interface C {
      \t// tabbed indentation
      \tstatic undefined koala();
      };
    `;
    const outputTabSpecialOp = `
      [Exposed=Window]
      interface C {
      \tconstructor();
      \t// tabbed indentation
      \tstatic undefined koala();
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
      [Exposed=Window,
       Constructor,
       Constructor(short photo),
       Constructor(any chocolate)]
      interface C {
        attribute any koala;
      };
    `;
    const outputMultiple = `
      [Exposed=Window]
      interface C {
        constructor();
        constructor(short photo);
        constructor(any chocolate);
        attribute any koala;
      };
    `;
    expect(autofix(inputMultiple)).toBe(outputMultiple);
  });

  it("should add `optional` for non-required dictionary arguments", () => {
    const input = `
      dictionary Optional {
        long long loooongInterviewProcess;
      };

      interface mixin Container {
        undefined op(
          DOMString str,
          Optional arg
        );
      };
    `;
    const output = `
      dictionary Optional {
        long long loooongInterviewProcess;
      };

      interface mixin Container {
        undefined op(
          DOMString str,
          optional Optional arg = {}
        );
      };
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should rename legacy extended attributes", () => {
    const input = `
      [Exposed=Window,
       NamedConstructor=TimeMachine(),
       NoInterfaceObject,
       OverrideBuiltins]
      interface HTMLTimeCapsule : HTMLElement {
        [LenientSetter] readonly attribute DOMString lenientSetter;
        [LenientThis] readonly attribute DOMString lenientThis;
        attribute [TreatNullAs] DOMString treatNullAs;
        undefined treatNullAsOp([TreatNullAs] DOMString str);
        [Unforgeable] readonly attribute DOMString unforgeable;
        [Unforgeable] DOMString unforgeableOp();
      };

      [TreatNonObjectAsNull]
      callback TreatsNonObjectAsNull = undefined (DOMString s);
    `;
    const output = `
      [Exposed=Window,
       LegacyFactoryFunction=TimeMachine(),
       LegacyNoInterfaceObject,
       LegacyOverrideBuiltIns]
      interface HTMLTimeCapsule : HTMLElement {
        [LegacyLenientSetter] readonly attribute DOMString lenientSetter;
        [LegacyLenientThis] readonly attribute DOMString lenientThis;
        attribute [LegacyNullToEmptyString] DOMString treatNullAs;
        undefined treatNullAsOp([LegacyNullToEmptyString] DOMString str);
        [LegacyUnforgeable] readonly attribute DOMString unforgeable;
        [LegacyUnforgeable] DOMString unforgeableOp();
      };

      [LegacyTreatNonObjectAsNull]
      callback TreatsNonObjectAsNull = undefined (DOMString s);
    `;
    expect(autofix(input)).toBe(output);
  });

  it("should replace undefined into undefined", () => {
    const input = `
      [Exposed=Window]
      interface Foo {
        void foo();
      };
    `;
    const output = `
      [Exposed=Window]
      interface Foo {
        undefined foo();
      };
    `;
    expect(autofix(input)).toBe(output);
  });
});
