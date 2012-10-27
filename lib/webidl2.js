

(function () {
    var tokenise = function (str) {
        var tokens = []
        ,   re = {
                "float":        /^-?(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/
            ,   "integer":      /^-?(0([0-7]*|[Xx][0-9A-Fa-f]+)|[1-9][0-9]*)/
            ,   "identifier":   /^[A-Z_a-z][0-9A-Z_a-z]*/
            ,   "string":       /^"[^"]*"/
            ,   "whitespace":   /^[\t\n\r ]+|[\t\n\r ]*((\/\/.*|\/\*(.|\n)*?\*\/)[\t\n\r ]*)+/
            ,   "other":        /^[^\t\n\r 0-9A-Z_a-z]/
            }
        ,   types = []
        ;
        for (var k in re) types.push(k);
        while (str.length > 0) {
            var matched = false;
            for (var i = 0, n = types.length; i < n; i++) {
                var type = types[i];
                str = str.replace(re[type], function (tok) {
                    tokens.push({ type: type, value: tok });
                    matched = true;
                    return "";
                });
                if (matched) break;
            }
            if (matched) continue;
            throw new Error("Token stream not progressing.");
        }
        return tokens;
    };
    
    var parse = function (tokens) {
        var line = 0;
        tokens = tokens.slice();
        
        var error = function (str) {
            throw str + ", line " + line;
        };
        
        var consume_known = function (type, value) {
            if (!tokens.length || tokens[0].type !== type) return;
            if (typeof value === "undefined" || tokens[0].value === value) return tokens.shift();
        };
        
        var ws = function () {
            if (!tokens.length) return;
            if (tokens[0].type === "whitespace") {
                var t = tokens.shift();
                t.value.replace(/\n/g, function (m) { line++; return m; });
                return t;
            }
        };
        
        var all_ws = function () {
            var t = { type: "whitespace", value: "" };
            while (true) {
                var w = ws();
                if (!w) break;
                t.value += w.value;
            }
            if (t.value.length > 0) return t;
        };
        
        var callback = function () {
            
        };
        
        var interface_ = function () {
            
        };
        
        var partial = function () {
            
        };
        
        var dictionary = function () {
            
        };
        
        var exception = function () {
            
        };
        
        var enum_ = function () {
            all_ws();
            if (!consume_known("identifier", "enum")) return;
            all_ws();
            var name = consume_known("identifier") || error("No name for enum");
            var ret = {
                type:   "enum"
            ,   name:   name.value
            ,   values: []
            };
            all_ws();
            consume_known("other", "{") || error("No curly for enum");
            var saw_comma = false;
            while (true) {
                all_ws();
                if (consume_known("other", "}")) {
                    all_ws();
                    if (saw_comma) error("Trailing comma in enum");
                    consume_known("other", ";") || error("No semicolon after enum");
                    return ret;
                }
                var val = consume_known("string") || error("Unexpected value in enum");
                ret.values.push(val.value.replace(/"/g, ""));
                all_ws();
                if (consume_known("other", ",")) {
                    all_ws();
                    saw_comma = true;
                }
                else {
                    saw_comma = false;
                }
            }
        };
        
        var typedef = function () {
            
        };
        
        var implements_ = function () {
            
        };
        
        var definition = function () {
            return  callback()      ||
                    interface_()    ||
                    partial()       ||
                    dictionary()    ||
                    exception()     ||
                    enum_()         ||
                    typedef()       ||
                    implements_()
                    ;
        };
        
        var definitions = function () {
            if (!tokens.length) return [];
            var defs = [];
            while (true) {
                var def = definition();
                if (!def) break;
                defs.push(def);
            }
            return defs;
        };
        
        return definitions();
    };

    var obj = {
        parse:  function (str) {
            var tokens = tokenise(str);
            console.log(tokens);
            return parse(tokens);
        }
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = obj;
    }
    else {
        window.WebIDL2 = obj;
    }
}());
