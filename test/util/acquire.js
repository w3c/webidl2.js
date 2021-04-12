import { collect } from "./collect.js";
import { writeFileSync } from "fs";

for (const test of collect("syntax")) {
  writeFileSync(test.baselinePath, `${JSON.stringify(test.ast, null, 4)}\n`);
}

for (const test of collect("invalid", { expectError: true, raw: true })) {
  const content = test.error
    ? test.error.message
    : test.validation
    ? test.validation.map((v) => `(${v.ruleName}) ${v.message}`).join("\n")
    : "";

  writeFileSync(test.baselinePath, `${content}\n`);
}
