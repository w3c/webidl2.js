const path = require("path");
const TerserPlugin = require('terser-webpack-plugin');
module.exports = {
  entry: "./index.js",
  output: {
    filename: "webidl2.js",
    path: path.resolve(__dirname, "dist"),
    library: "WebIDL2",
    libraryTarget: "umd",
    globalObject: "this"
  },
  mode: "production",
  devtool: "source-map",
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: {
            keep_classnames: true
          }
        }
      })
    ]
  }

};
