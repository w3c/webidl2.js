import { Container } from "./container.js";
import { Interface } from "./interface.js";
import { Attribute } from "./attribute.js";
import { Operation } from "./operation.js";

export class Module extends Container {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser, { partial } = {}) {
    function module_interface() {
      const partial = tokeniser.consume("partial");
      const base = tokeniser.consume("interface");
      if (!base) {
        if (partial) {
          throw new Error("Unsupported partial declaration in a module");
        }
        return;
      }
      return Interface.parse(tokeniser, base, { partial });
    }
    const tokens = { partial };
    tokens.base = tokeniser.consume("module");
    if (!tokens.base) {
      return;
    }
    return Container.parse(tokeniser, new Module({ tokens }), {
      type: "module",
      allowedMembers: [
        [module_interface],
        [Attribute.parse, { noInherit: true, readonly: true }],
        [Operation.parse, { regular: true }]
      ]
    });
  }

  get type() {
    return "module";
  }
}
