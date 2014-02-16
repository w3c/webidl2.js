
(function () {

    var write = function (ast, opt) {
        var curPea = ""
        ,   opt = opt || {}
        ;
        
        var literal = function (it) {
            return it.value;
        };
        var wsPea = function (it) {
            curPea += it.value;
            return "";
        };
        var lineComment = function (it) {
            return "//" + it.value + "\n";
        };
        var multilineComment = function (it) {
            return "/*" + it.value + "*/";
        };
        var type = function (it) {
            if (typeof it === "string") return it;
            var ret = "";
            if (it.sequence) ret += "sequence<";
            if (it.union) {
                ret += "(" + it.idlType.map(type).join(" or ") + ")";
            }
            else {
                ret += it.idlType;
            }
            if (it.array) ret += (new Array(it.array + 1)).join("[]");
            if (it.sequence) ret += ">";
            if (it.nullable) ret += "?";

            return ret;
        };
        var argument = function (arg, pea) {
            var ret = extended_attributes(arg.extAttrs, pea);
            if (arg.optional) ret += "optional ";
            ret += type(arg.idlType);
            if (arg.variadic) ret += "...";
            ret += " " + arg.name;
            return ret;
        };
        var args = function (its) {
            var res = ""
            ,   pea = ""
            ;
            for (var i = 0, n = its.length; i < n; i++) {
                var arg = its[i];
                if (arg.type === "ws") res += arg.value;
                else if (arg.type === "ws-pea") pea += arg.value;
                else {
                    res += argument(arg, pea);
                    if (i < n - 1) res += ",";
                    pea = "";
                }
            }
            return res;
        };
        var make_ext_at = function (it) {
            if (it["arguments"] === null) return it.name;
            return it.name + "(" + (it["arguments"].length ? args(it["arguments"]) : "") + ")";
        };
        var extended_attributes = function (eats, pea) {
            if (!eats || !eats.length) return "";
            return "[" + eats.map(make_ext_at).join(", ") + "]" + pea;
        };
        
        var operation = function (it) {
            // XXX
        };
        var attribute = function (it) {
            // XXX
        };
        
        var interface_ = function (it) {
            var ret = "";
            ret += extended_attributes(it.extAttrs, curPea);
            if (it.partial) ret += "partial ";
            ret += "interface " + it.name + " ";
            if (it.inheritance) ret += ": " + it.inheritance + " ";
            ret += "{";
            iterate(it.members);
            ret += "};";
            return ret;
        };
        
        
        var table = {
            ws:                     literal
        ,   "ws-pea":               wsPea
        ,   "line-comment":         lineComment
        ,   "multiline-comment":    multilineComment
        ,   "interface":            interface_
        ,   operation:              operation
        ,   attribute:              attribute
        };
        var dispatch = function (it) {
            return table[it.type](it);
        };
        var iterate = function (things) {
            if (!things) return;
            var ret = "";
            for (var i = 0, n = things.length; i < n; i++) ret += dispatch(things[i]);
            return ret;
        };
        return iterate(ast);
    };


    var inNode = typeof module !== "undefined" && module.exports
    ,   obj = {
            write:  function (ast, opt) {
                if (!opt) opt = {};
                return write(ast, opt);
            }
    };

    if (inNode) module.exports = obj;
    else        window.WebIDL2Writer = obj;
    
}());


//     {
//         "type": "interface",
//         "name": "Whatever",
//         "partial": false,
//         "inheritance": null,
//         "extAttrs": [
//             {
//                 "name": "Constructor",
//                 "arguments": null
//             }
//         ],
//         "members": [
//             {
//                 "type": "ws",
//                 "value": "\n    "
//             },
//             {
//                 "type": "line-comment",
//                 "value": "* this is method foo"
//             },
//             {
//                 "type": "ws",
//                 "value": "\n    "
//             },
//             {
//                 "type": "operation",
//                 "getter": false,
//                 "setter": false,
//                 "creator": false,
//                 "deleter": false,
//                 "legacycaller": false,
//                 "static": false,
//                 "stringifier": false,
//                 "idlType": {
//                     "sequence": false,
//                     "nullable": false,
//                     "array": false,
//                     "union": false,
//                     "idlType": "void"
//                 },
//                 "name": "foo",
//                 "arguments": [],
//                 "extAttrs": []
//             },
//             {
//                 "type": "ws",
//                 "value": "\n    "
//             },
//             {
//                 "type": "multiline-comment",
//                 "value": " this attribute rocks"
//             },
//             {
//                 "type": "ws",
//                 "value": "\n    "
//             },
//             {
//                 "type": "attribute",
//                 "static": false,
//                 "stringifier": false,
//                 "inherit": false,
//                 "readonly": true,
//                 "idlType": {
//                     "sequence": false,
//                     "nullable": false,
//                     "array": false,
//                     "union": false,
//                     "idlType": "DOMString"
//                 },
//                 "name": "bar",
//                 "extAttrs": []
//             },
//             {
//                 "type": "ws",
//                 "value": "\n"
//             }
//         ]
//     }
