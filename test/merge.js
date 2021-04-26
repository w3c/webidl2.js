import expect from "expect";
import { parse, write, merge } from "webidl2";

// Collapse sequences of whitespace to a single space.
function collapse(s) {
  return s.trim().replace(/\s+/g, " ");
}

expect.extend({
  toMergeAs(received, expected) {
    received = collapse(received);
    expected = collapse(expected);
    const ast = parse(received);
    const merged = merge(ast);
    const actual = collapse(write(merged));
    if (actual === expected) {
      return {
        message: () =>
          `expected ${JSON.stringify(
            received
          )} to not merge as ${JSON.stringify(expected)} but it did`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to merge as ${JSON.stringify(
            expected
          )} but got ${JSON.stringify(actual)}`,
        pass: false,
      };
    }
  },
});

describe("merge()", () => {
  it("empty array", () => {
    const result = merge([]);
    expect(result).toHaveLength(0);
  });

  it("partial dictionary", () => {
    expect(`
      dictionary D { };
      partial dictionary D { boolean extra = true; };
    `).toMergeAs(`
      dictionary D { boolean extra = true; };
    `);
  });

  it("partial interface", () => {
    expect(`
      interface I { };
      partial interface I { attribute boolean extra; };
    `).toMergeAs(`
      interface I { attribute boolean extra; };
    `);
  });

  it("partial interface with [Exposed]", () => {
    expect(`
      [Exposed=(Window,Worker)] interface I { };
      [Exposed=Worker] partial interface I {
        attribute boolean extra;
      };
    `).toMergeAs(`
      [Exposed=(Window,Worker)] interface I {
        [Exposed=Worker] attribute boolean extra;
      };
    `);
  });
});
