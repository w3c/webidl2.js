"use strict";

const { collect } = require("./util/collect");
const wp = require("..");
const expect = require("expect");
const webidl2 = require("..");

describe("Rewrite and parses all of the IDLs to produce the same ASTs", () => {
  for (const test of collect("syntax")) {
    it(`should produce the same AST for ${test.path}`, () => {
      const rewritten = wp.write(test.ast);
      expect(rewritten).toEqual(test.text);
      const diff = test.diff(wp.parse(rewritten, test.opt));
      expect(diff).toBe(undefined);
    });
  }
});

describe("Writer template functions", () => {
  function rewrite(text, templates) {
    return webidl2.write(webidl2.parse(text), { templates });
  }
  function bracket(str) {
    return `<${str}>`;
  }
  function flatten(array) {
    return [].concat(...array.map(item => Array.isArray(item) ? flatten(item) : item));
  }

  it("wraps in array", () => {
    const result = rewrite("interface X {};", {
      wrap: items => flatten(items).filter(i => i)
    });
    expect(result).toEqual(["interface", " ", "X", " ", "{", "}", ";"]);
  });

  it("catches trivia", () => {
    const result = rewrite("/* longcat is long */ interface X {};", {
      trivia: bracket
    });
    expect(result).toBe("</* longcat is long */ >interface< >X< >{<>}<>;<>");
  });

  it("catches names", () => {
    function rewriteName(text) {
      return rewrite(text, { name: bracket });
    }

    const result = rewriteName("interface Momo { attribute long iro; };");
    expect(result).toBe("interface <Momo> { attribute long <iro>; };");

    const typedef = rewriteName("typedef float Float;");
    expect(typedef).toBe("typedef float <Float>;");

    const enumeration = rewriteName('enum Enum { "item", };');
    expect(enumeration).toBe('enum <Enum> { "<item>", };');

    const dictionary = rewriteName("dictionary Dict { required short field; };");
    expect(dictionary).toBe("dictionary <Dict> { required short <field>; };");
  });

  it("catches references", () => {
    function rewriteReference(text) {
      return rewrite(text, { reference: bracket });
    }

    const result = rewriteReference("[Exposed=Window] interface Momo : Kudamono { attribute Promise<unsigned long> iro; };");
    expect(result).toBe("[Exposed=<Window>] interface Momo : <Kudamono> { attribute <Promise><<unsigned long>> iro; };");

    const includes = rewriteReference("_A includes _B;");
    expect(includes).toBe("<_A> includes <_B>;");
  });

  it("catches references as unescaped", () => {
    function rewriteReference(text) {
      return rewrite(text, { reference: (_, unescaped) => bracket(unescaped) });
    }

    const result = rewriteReference("[Exposed=Window] interface Momo : _Kudamono { attribute Promise<_Type> iro; attribute _Type sugar; };");
    expect(result).toBe("[Exposed=<Window>] interface Momo : <Kudamono> { attribute <Promise><<Type>> iro; attribute <Type> sugar; };");

    const includes = rewriteReference("_A includes _B;");
    expect(includes).toBe("<A> includes <B>;");
  });

  it("catches types", () => {
    const result = rewrite("interface Momo { attribute Promise<unsigned long> iro; };", {
      type: bracket
    });
    expect(result).toBe("interface Momo { attribute< Promise<unsigned long>> iro; };");
  });

  it("catches value literals", () => {
    const result = rewrite("dictionary Nene { DOMString cpp = \"high\"; };", {
      valueLiteral: bracket
    });
    expect(result).toBe("dictionary Nene { DOMString cpp = <\"high\">; };");
  });

  it("catches inheritances", () => {
    const result = rewrite("dictionary Nene : Member { DOMString cpp = \"high\"; };", {
      inheritance: bracket
    });
    expect(result).toBe("dictionary Nene : <Member> { DOMString cpp = \"high\"; };");
  });

  it("catches definitions", () => {
    const result = rewrite("dictionary Nene { DOMString cpp = \"high\"; };", {
      definition: bracket
    });
    expect(result).toBe("<dictionary Nene {< DOMString cpp = \"high\";> };>");
  });

  it("catches extended attributes", () => {
    const result = rewrite("[Exposed=Window, Constructor] interface EagleJump { void aoba([Clamp] long work); };", {
      extendedAttribute: bracket
    });
    expect(result).toBe("[<Exposed=Window>, <Constructor>] interface EagleJump { void aoba([<Clamp>] long work); };");
  });

  it("catches extended attribute references", () => {
    const result = rewrite("[Exposed=Window, Constructor] interface EagleJump { void aoba([Clamp] long work); };", {
      extendedAttributeReference: bracket
    });
    expect(result).toBe("[<Exposed>=Window, <Constructor>] interface EagleJump { void aoba([<Clamp>] long work); };");
  });
});
