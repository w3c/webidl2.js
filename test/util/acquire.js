"use strict";

const { collect } = require("./collect");
const fs = require("fs");

for (const test of collect("syntax")) {
  fs.writeFileSync(test.baselinePath, `${JSON.stringify(test.ast, null, 4)}\n`);
}

for (const test of collect("invalid", { expectError: true, raw: true })) {
  fs.writeFileSync(test.baselinePath, test.error ? `${test.error.message}\n` : "\n");
}
