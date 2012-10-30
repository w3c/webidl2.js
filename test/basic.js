var wp = require("../")
,   _  = require("underscore")
,   pth = require("path")
,   fs = require("fs")
,   jdp = require("jsondiffpatch")
;
describe("Parses all of the IDLs to produce the correct ASTs", function () {
    ["dom", "esidl"].forEach(function (subdir) {
        var dir = pth.join(__dirname, subdir)
        ,   idls = fs.readdirSync(dir)
                      .filter(function (it) { return (/\.idl$/).test(it); })
                      .map(function (it) { return pth.join(dir, it); })
        ,   jsons = idls.map(function (it) { return it.replace(/\.idl$/, ".json"); })
        ;
        var target = 0;
        for (var i = 0, n = idls.length; i < n; i++) {
            var idl = idls[i], json = jsons[i];
            console.log("I=" + i);
            if (i === target) {
                console.log(idl);
                var jsonView = JSON.parse(fs.readFileSync(json, "utf8"));
                var idlView = wp.parse(fs.readFileSync(idl, "utf8"));
                // console.log(JSON.stringify(jsonView, null, 4));
                // console.log("######");
                // console.log(JSON.stringify(idlView, null, 4));
                console.log(JSON.stringify(jdp.diff(jsonView, idlView), null, 4));
                console.log(JSON.stringify(idlView, null, 4));
            }
            it("should produce the same AST for " + idl, function () {
                _.isEqual(JSON.parse(fs.readFileSync(json, "utf8")),
                          wp.parse(fs.readFileSync(idl, "utf8"))).should.be.true;
            });
            if (i === target) process.exit();
        }
    });
});