var wp = require("../")
,   _  = require("underscore")
,   pth = require("path")
,   fs = require("fs")
;
describe("Parses all of the IDLs to produce the correct ASTs", function () {
    ["dom", "esidl"].forEach(function (subdir) {
        var dir = pth.join(__dirname, subdir)
        ,   idls = fs.readdirSync(dir)
                      .filter(function (it) { return (/\.idl$/).test(it); })
                      .map(function (it) { return pth.join(dir, it); })
        ,   jsons = idls.map(function (it) { return it.replace(/\.idl$/, ".json"); })
        ;
        for (var i = 0, n = idls.length; i < n; i++) {
            var idl = idls[i], json = jsons[i];
            it("should produce the same AST for " + idl, function () {
                _.isEqual(JSON.parse(fs.readFileSync(json, "utf8")),
                          wp.parse(fs.readFileSync(idl, "utf8"))).should.be.true;
            });
        }
    });
});