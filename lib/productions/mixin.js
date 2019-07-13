import { Container } from "./container.js";
import { Constant } from "./constant.js";
import { Attribute } from "./attribute.js";
import { Operation } from "./operation.js";
import { stringifier } from "./helpers.js";

export class Mixin extends Container {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser, base, { partial } = {}) {
    const tokens = { partial, base };
    tokens.mixin = tokeniser.consume("mixin");
    if (!tokens.mixin) {
      return;
    }
    return Container.parse(tokeniser, new Mixin({ source: tokeniser.source, tokens }), {
      type: "interface mixin",
      allowedMembers: [
        [Constant.parse],
        [stringifier],
        [Attribute.parse, { noInherit: true }],
        [Operation.parse, { regular: true }]
      ]
    });
  }

  get type() {
    return "interface mixin";
  }
}
