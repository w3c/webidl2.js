import expect from "expect";
import { parse } from "webidl2";

function checkIdlType(idlType) {
  if (idlType.subtype) {
    for (const subtype of idlType.subtype) {
      expect(subtype.parent).toBe(idlType);
      checkIdlType(subtype);
    }
  }
}

function checkParent(data) {
  if (data.extAttrs && data.extAttrs.length) {
    expect(data.extAttrs.parent).toBe(data);
    for (const extAttr of data.extAttrs) {
      expect(extAttr.parent).toBe(data.extAttrs);
      checkParent(extAttr);
    }
  }
  switch (data.type) {
    case "interface":
    case "namespace":
    case "callback interface":
    case "interface mixin":
    case "dictionary": {
      for (const member of data.members) {
        expect(member.parent).toBe(data);
        checkParent(member);
      }
      break;
    }
    case "enum": {
      for (const value of data.values) {
        expect(value.parent).toBe(data);
        checkParent(value);
      }
      break;
    }
    case "constructor":
    case "operation":
    case "callback":
    case "extended-attribute": {
      for (const member of data.arguments) {
        expect(member.parent).toBe(data);
        checkParent(member);
      }
      if (data.idlType) {
        expect(data.idlType.parent).toBe(data);
        checkIdlType(data.idlType);
      }
      break;
    }
    case "iterable":
    case "setlike":
    case "maplike": {
      for (const subtype of data.idlType) {
        expect(subtype.parent).toBe(data);
        checkIdlType(subtype);
      }
      break;
    }
    case "const":
    case "field":
    case "argument":
    case "typedef": {
      if (data.default) {
        expect(data.default.parent).toBe(data);
      }
      expect(data.idlType.parent).toBe(data);
      checkIdlType(data.idlType);
      break;
    }
  }
}

/**
 * @param {string} idl
 */
function parseAndCheck(idl) {
  const tree = parse(idl);
  for (const item of tree) {
    checkParent(item);
  }
}

describe("Parent field", () => {
  it("should link to parents in interfaces", () => {
    parseAndCheck(`
      interface X {
        constructor();
        constructor(short s, long l);
        void foo();
        void foo(DOMString str, object obj);
        void bar(optional Dict dict = {});
        attribute Identifier i;
        iterable<DOMString>;
        setlike<DOMString>; // invalid but okay to parse
        maplike<DOMString, DOMString>;
        const short CONST = 3;
      };
    `);
  });

  it("should link to parents in namespaces", () => {
    parseAndCheck(`
      namespace Y {
        void foo();
        void foo(DOMString str, object obj);
        readonly attribute Identifier i;
      };
    `);
  });

  it("should link to parents in interface mixins", () => {
    parseAndCheck(`
      interface mixin Z {
        void foo();
        void foo(DOMString str, object obj);
        attribute Identifier i;
        const short CONST = 3;
      };
    `);
  });

  it("should link to parents in callback interfaces", () => {
    parseAndCheck(`
      callback interface W {
        void foo();
        void foo(DOMString str, object obj);
        const short CONST = 3;
      };
    `);
  });

  it("should link to parents in callbacks", () => {
    parseAndCheck(`
      callback Callback = boolean ((DOMString or (short or Identifier)) str);
    `);
  });

  it("should link to parents in dictionaries", () => {
    parseAndCheck(`
      dictionary Dict {
        required Type requiredField;
        Type? optionalField = null;
      };
    `);
  });

  it("should link to parents in typedefs", () => {
    parseAndCheck(`
      typedef (DOMString or (short or Identifier)) Typedef;
    `);
  });
});
