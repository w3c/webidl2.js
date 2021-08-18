"use strict";

import expect from "expect";
import { parse, write } from "webidl2";

describe("Writer template functions", () => {
  const customIdl = `
    interface X {};
    custom Y;
  `;

  /**
   * @param {import("../lib/tokeniser").Tokeniser} tokeniser
   */
  const customProduction = (tokeniser) => {
    const { position } = tokeniser;
    const base = tokeniser.consumeIdentifier("custom");
    if (!base) {
      return;
    }
    const tokens = { base };
    tokens.name = tokeniser.consumeKind("identifier");
    tokens.termination = tokeniser.consume(";");
    if (!tokens.name || !tokens.termination) {
      tokeniser.unconsume(position);
      return;
    }
    return {
      type: "custom",
      tokens,
      /** @param {import("../lib/writer.js").Writer} w */
      write(w) {
        return w.ts.wrap([
          w.token(this.tokens.base),
          w.token(this.tokens.name),
          w.token(this.tokens.termination),
        ]);
      },
    };
  };

  const result = parse(customIdl, {
    productions: [customProduction],
    concrete: true,
  });
  expect(result[0].type).toBe("interface");
  expect(result[1].type).toBe("custom");

  const rewritten = write(result);
  expect(rewritten).toBe(customIdl);
});
