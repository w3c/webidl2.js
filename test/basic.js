var wp = require("../")
,   _  = require("underscore")
,   pth = require("path")
,   fs = require("fs")
,   jdp = require("jsondiffpatch")
,   ported = ["esidl/1.idl", "esidl/10.idl", "esidl/7.idl"]
;
describe("Parses all of the IDLs to produce the correct ASTs", function () {
    ["dom", "esidl"].forEach(function (subdir) {
        var dir = pth.join(__dirname, subdir)
        ,   idls = fs.readdirSync(dir)
                      .filter(function (it) { return (/\.idl$/).test(it); })
                      .map(function (it) { return pth.join(dir, it); })
        ,   jsons = idls.map(function (it) { return it.replace(/\.idl$/, ".json"); })
        ,   okay = _.clone(ported)
                    .filter(function (it) { return it.indexOf(subdir) === 0; })
                    .map(function (it) { return pth.join(__dirname, it); })
        ;
        for (var i = 0, n = idls.length; i < n; i++) {
            var idl = idls[i], json = jsons[i];
            var func = (function (idl, json) {
                return function () {
                    var diff = jdp.diff(JSON.parse(fs.readFileSync(json, "utf8")),
                                        wp.parse(fs.readFileSync(idl, "utf8")));
                    if (typeof diff === "undefined") true.should.be["true"];
                    else false.should.be["true"];
                };
            }(idl, json));
            if (okay.indexOf(idl) > -1) it("should produce the same AST for " + idl, func);
            else it.skip("should produce the same AST for " + idl);
        }
    });
});