import { Container } from "./container.js";
import { Operation } from "./operation.js";
import { Constant } from "./constant.js";

export class CallbackInterface extends Container {
  /**
   * @param {import("../tokeniser.js").Tokeniser} tokeniser
   * @param {*} callback
   * @param {object} [options]
   * @param {boolean} [options.inheritable]
   * @param {import("./container.js").AllowedMember[]} [options.extMembers]
   */
  static parse(tokeniser, callback, { inheritable, extMembers = [] } = {}) {
    const tokens = { callback };
    tokens.base = tokeniser.consume("interface");
    if (!tokens.base) {
      return;
    }
    return Container.parse(
      tokeniser,
      new CallbackInterface({ source: tokeniser.source, tokens }),
      {
        inheritable: !!inheritable,
        allowedMembers: [
          ...extMembers,
          [Constant.parse],
          [Operation.parse, { regular: true }],
        ],
      }
    );
  }

  get type() {
    return "callback interface";
  }
}
