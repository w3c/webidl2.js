const expect = require("expect");
const webidl2 = require("webidl2");

describe("CommonJS import", () => {
  it("require() gets the relevant items", () => {
    expect(webidl2.parse).toBeTruthy();
  });
});
