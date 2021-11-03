const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
module.exports = {
  entry: "./index.js",
  output: {
    filename: "webidl2.js",
    path: path.resolve(__dirname, "dist"),
    library: "WebIDL2",
    libraryTarget: "umd",
    globalObject: "globalThis",
  },
  mode: "production",
  devtool: "source-map",
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          sourceMap: true,
        },
      }),
    ],
  },
};
