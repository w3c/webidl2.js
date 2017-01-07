

(function () {
    function tokenise(str) {
        var tokens = []
        ,   re = {
                "float":        /^-?(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/
            ,   "integer":      /^-?(0([Xx][0-9A-Fa-f]+|[0-7]*)|[1-9][0-9]*)/
            ,   "identifier":   /^[A-Z_a-z][0-9A-Z_a-z-]*/
            ,   "string":       /^"[^"]*"/
            ,   "whitespace":   /^(?:[\t\n\r ]+|[\t\n\r ]*((\/\/.*|\/\*(.|\n|\r)*?\*\/)[\t\n\r ]*))+/
            ,   "other":        /^[^\t\n\r 0-9A-Z_a-z]/
            }
        ;
        while (str) {
            var matched = Object.keys(re).some(function(type) {
                var matched = false;

                str = str.replace(re[type], function (tok) {
                    tokens.push({ type: type, value: tok });
                    matched = true;
                    return "";
                });

                return matched;
            });

            if (!matched) {
                throw new Error("Token stream not progressing");
            }
        }
        return tokens;
    };

    function WebIDLParseError(str, line, input, tokens) {
      this.message = str;
      this.line = line;
      this.input = input;
      this.tokens = tokens;
    };

    WebIDLParseError.prototype.toString = function() {
      return this.message + ", line " + this.line + " (tokens: '" + this.input + "')\n" +
        JSON.stringify(this.tokens, null, 4);
    };

    function parse(tokens, opt) {
        var line = 1;
        tokens = tokens.slice();

        var FLOAT = "float"
        ,   INT = "integer"
        ,   ID = "identifier"
        ,   STR = "string"
        ,   OTHER = "other"
        ;

        function error(str) {
            var last5 = tokens.slice(0, 5);
            var tok = last5.reduce(function(tok, token) {
                return tok + token.value;
            }, "");
            throw new WebIDLParseError(str, line, tok, last5);
        };

        var last_token = null;

        function consume(type, value) {
            if (!tokens.length || tokens[0].type !== type) return;
            if (typeof value === "undefined" || tokens[0].value === value) {
                 last_token = tokens.shift();
                 if (type === ID) last_token.value = last_token.value.replace(/^_/, "");
                 return last_token;
             }
        };

        function ws() {
            if (!tokens.length) return;
            if (tokens[0].type === "whitespace") {
                var t = tokens.shift();
                t.value.replace(/\n/g, function (m) { line++; return m; });
                return t;
            }
        };

        function all_ws() {
            var token = { type: "whitespace", value: "" };
            for (var wsToken = ws(); wsToken; wsToken = ws()) {
                token.value += wsToken.value;
            }
            if (token.value) {
                return token;
            }
        };

        function integer_type() {
            var ret = "";
            all_ws();
            if (consume(ID, "unsigned")) ret = "unsigned ";
            all_ws();
            if (consume(ID, "short")) return ret + "short";
            if (consume(ID, "long")) {
                ret += "long";
                all_ws();
                if (consume(ID, "long")) return ret + " long";
                return ret;
            }
            if (ret) error("Failed to parse integer type");
        };

        function float_type() {
            var ret = "";
            all_ws();
            if (consume(ID, "unrestricted")) ret = "unrestricted ";
            all_ws();
            if (consume(ID, "float")) return ret + "float";
            if (consume(ID, "double")) return ret + "double";
            if (ret) error("Failed to parse float type");
        };

        function primitive_type() {
            var num_type = integer_type() || float_type();
            if (num_type) return num_type;
            all_ws();
            if (consume(ID, "boolean")) return "boolean";
            if (consume(ID, "byte")) return "byte";
            if (consume(ID, "octet")) return "octet";
        };

        function const_value() {
            if (consume(ID, "true")) return { type: "boolean", value: true };
            if (consume(ID, "false")) return { type: "boolean", value: false };
            if (consume(ID, "null")) return { type: "null" };
            if (consume(ID, "Infinity")) return { type: "Infinity", negative: false };
            if (consume(ID, "NaN")) return { type: "NaN" };
            var ret = consume(FLOAT) || consume(INT);
            if (ret) return { type: "number", value: 1 * ret.value };
            var tok = consume(OTHER, "-");
            if (tok) {
                if (consume(ID, "Infinity")) return { type: "Infinity", negative: true };
                else tokens.unshift(tok);
            }
        };

        function type_suffix(obj) {
            var token;
            do {
                all_ws();
                if (token = consume(OTHER, "?")) {
                    if (obj.nullable) error("Can't nullable more than once");
                    obj.nullable = true;
                }
                else if (token = consume(OTHER, "[")) {
                    all_ws();
                    consume(OTHER, "]") || error("Unterminated array type");
                    if (!obj.array) {
                        obj.array = 1;
                        obj.nullableArray = [obj.nullable];
                    }
                    else {
                        obj.array++;
                        obj.nullableArray.push(obj.nullable);
                    }
                    obj.nullable = false;
                }
            } while (token);
        };

        function single_type() {
            var prim = primitive_type()
            ,   ret = { sequence: false, generic: null, nullable: false, array: false, union: false }
            ,   name
            ,   value
            ;
            if (prim) {
                ret.idlType = prim;
            }
            else if (name = consume(ID)) {
                value = name.value;
                all_ws();
                // Generic types
                if (consume(OTHER, "<")) {
                    // backwards compat
                    if (value === "sequence") {
                        ret.sequence = true;
                    }
                    ret.generic = value;
                    ret.idlType = type() || error("Error parsing generic type " + value);
                    all_ws();
                    if (!consume(OTHER, ">")) error("Unterminated generic type " + value);
                    type_suffix(ret);
                    return ret;
                }
                else {
                    ret.idlType = value;
                }
            }
            else {
                return;
            }
            type_suffix(ret);
            if (ret.nullable && !ret.array && ret.idlType === "any") error("Type any cannot be made nullable");
            return ret;
        };

        function union_type() {
            all_ws();
            if (!consume(OTHER, "(")) return;
            var ret = { sequence: false, generic: null, nullable: false, array: false, union: true, idlType: [] };
            var fst = type() || error("Union type with no content");
            ret.idlType.push(fst);
            for (all_ws(); consume(ID, "or"); all_ws()) {
                var typ = type() || error("No type after 'or' in union type");
                ret.idlType.push(typ);
            }
            if (!consume(OTHER, ")")) error("Unterminated union type");
            type_suffix(ret);
            return ret;
        };

        function type() {
            return single_type() || union_type();
        };

        function argument() {
            var ret = { optional: false, variadic: false };
            ret.extAttrs = extended_attrs();
            all_ws();
            var opt_token = consume(ID, "optional");
            if (opt_token) {
                ret.optional = true;
                all_ws();
            }
            ret.idlType = type();
            if (!ret.idlType) {
                if (opt_token) tokens.unshift(opt_token);
                return;
            }
            var type_token = last_token;
            if (!ret.optional) {
                all_ws();
                if (tokens.length >= 3 &&
                    tokens[0].type === "other" && tokens[0].value === "." &&
                    tokens[1].type === "other" && tokens[1].value === "." &&
                    tokens[2].type === "other" && tokens[2].value === "."
                    ) {
                    tokens.shift();
                    tokens.shift();
                    tokens.shift();
                    ret.variadic = true;
                }
            }
            all_ws();
            var name = consume(ID);
            if (!name) {
                if (opt_token) tokens.unshift(opt_token);
                tokens.unshift(type_token);
                return;
            }
            ret.name = name.value;
            if (ret.optional) {
                all_ws();
                var dflt = default_();
                if (typeof dflt !== "undefined") {
                    ret["default"] = dflt;
                }
            }
            return ret;
        };

        function argument_list() {
            var ret = []
            ,   arg = argument()
            ;
            if (!arg) return;
            ret.push(arg);
            for (all_ws(); consume(OTHER, ","); all_ws()) {
                var nxt = argument() || error("Trailing comma in arguments list");
                ret.push(nxt);
            }
            return ret;
        };

        function type_pair() {
            all_ws();
            var k = type();
            if (!k) return;
            all_ws()
            if (!consume(OTHER, ",")) return;
            all_ws();
            var v = type();
            if (!v) return;
            return [k, v];
        };

        function simple_extended_attr() {
            all_ws();
            var name = consume(ID);
            if (!name) return;
            var ret = {
                name: name.value
            ,   "arguments": null
            };
            all_ws();
            var eq = consume(OTHER, "=");
            if (eq) {
                var rhs;
                all_ws();
                if (rhs = consume(ID)) {
                  ret.rhs = rhs
                }
                else if (rhs = consume(FLOAT)) {
                  ret.rhs = rhs
                }
                else if (rhs = consume(INT)) {
                  ret.rhs = rhs
                }
                else if (rhs = consume(STR)) {
                  ret.rhs = rhs
                }
                else if (consume(OTHER, "(")) {
                    // [Exposed=(Window,Worker)]
                    rhs = [];
                    var id = consume(ID);
                    if (id) {
                      rhs = [id.value];
                    }
                    identifiers(rhs);
                    consume(OTHER, ")") || error("Unexpected token in extended attribute argument list or type pair");
                    ret.rhs = {
                        type: "identifier-list",
                        value: rhs
                    };
                }
                if (!ret.rhs) return error("No right hand side to extended attribute assignment");
            }
            all_ws();
            if (consume(OTHER, "(")) {
                var args, pair;
                // [Constructor(DOMString str)]
                if (args = argument_list()) {
                    ret["arguments"] = args;
                }
                // [MapClass(DOMString, DOMString)]
                else if (pair = type_pair()) {
                    ret.typePair = pair;
                }
                // [Constructor()]
                else {
                    ret["arguments"] = [];
                }
                all_ws();
                consume(OTHER, ")") || error("Unexpected token in extended attribute argument list or type pair");
            }
            return ret;
        };

        // Note: we parse something simpler than the official syntax. It's all that ever
        // seems to be used
        function extended_attrs() {
            var eas = [];
            all_ws();
            if (!consume(OTHER, "[")) return eas;
            eas[0] = simple_extended_attr() || error("Extended attribute with not content");
            all_ws();
            while (consume(OTHER, ",")) {
                eas.push(simple_extended_attr() || error("Trailing comma in extended attribute"));
                all_ws();
            }
            consume(OTHER, "]") || error("No end of extended attribute");
            return eas;
        };

        function default_() {
            all_ws();
            if (consume(OTHER, "=")) {
                all_ws();
                var def = const_value();
                if (def) {
                    return def;
                }
                else if (consume(OTHER, "[")) {
                    if (!consume(OTHER, "]")) error("Default sequence value must be empty");
                    return { type: "sequence", value: [] };
                }
                else {
                    var str = consume(STR) || error("No value for default");
                    str.value = str.value.replace(/^"/, "").replace(/"$/, "");
                    return str;
                }
            }
        };

        function const_() {
            all_ws();
            if (!consume(ID, "const")) return;
            var ret = { type: "const", nullable: false };
            all_ws();
            var typ = primitive_type();
            if (!typ) {
                typ = consume(ID) || error("No type for const");
                typ = typ.value;
            }
            ret.idlType = typ;
            all_ws();
            if (consume(OTHER, "?")) {
                ret.nullable = true;
                all_ws();
            }
            var name = consume(ID) || error("No name for const");
            ret.name = name.value;
            all_ws();
            consume(OTHER, "=") || error("No value assignment for const");
            all_ws();
            var cnt = const_value();
            if (cnt) ret.value = cnt;
            else error("No value for const");
            all_ws();
            consume(OTHER, ";") || error("Unterminated const");
            return ret;
        };

        function inheritance() {
            all_ws();
            if (consume(OTHER, ":")) {
                all_ws();
                var inh = consume(ID) || error ("No type in inheritance");
                return inh.value;
            }
        };

        function operation_rest(ret) {
            all_ws();
            if (!ret) ret = {};
            var name = consume(ID);
            ret.name = name ? name.value : null;
            all_ws();
            consume(OTHER, "(") || error("Invalid operation");
            ret["arguments"] = argument_list() || [];
            all_ws();
            consume(OTHER, ")") || error("Unterminated operation");
            all_ws();
            consume(OTHER, ";") || error("Unterminated operation");
            return ret;
        };

        function callback() {
            all_ws();
            var ret;
            if (!consume(ID, "callback")) return;
            all_ws();
            var tok = consume(ID, "interface");
            if (tok) {
                tokens.unshift(tok);
                ret = interface_();
                ret.type = "callback interface";
                return ret;
            }
            var name = consume(ID) || error("No name for callback");
            ret = { type: "callback", name: name.value };
            all_ws();
            consume(OTHER, "=") || error("No assignment in callback");
            all_ws();
            ret.idlType = return_type();
            all_ws();
            consume(OTHER, "(") || error("No arguments in callback");
            ret["arguments"] = argument_list() || [];
            all_ws();
            consume(OTHER, ")") || error("Unterminated callback");
            all_ws();
            consume(OTHER, ";") || error("Unterminated callback");
            return ret;
        };

        function attribute() {
            all_ws();
            var grabbed = []
            ,   ret = {
                type:           "attribute"
            ,   "static":       false
            ,   stringifier:    false
            ,   inherit:        false
            ,   readonly:       false
            };
            if (consume(ID, "static")) {
                ret["static"] = true;
                grabbed.push(last_token);
            }
            else if (consume(ID, "stringifier")) {
                ret.stringifier = true;
                grabbed.push(last_token);
            }
            var w = all_ws();
            if (w) grabbed.push(w);
            if (consume(ID, "inherit")) {
                if (ret["static"] || ret.stringifier) error("Cannot have a static or stringifier inherit");
                ret.inherit = true;
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            if (consume(ID, "readonly")) {
                ret.readonly = true;
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            if (!consume(ID, "attribute")) {
                tokens = grabbed.concat(tokens);
                return;
            }
            all_ws();
            ret.idlType = type() || error("No type in attribute");
            if (ret.idlType.sequence) error("Attributes cannot accept sequence types");
            all_ws();
            var name = consume(ID) || error("No name in attribute");
            ret.name = name.value;
            all_ws();
            consume(OTHER, ";") || error("Unterminated attribute");
            return ret;
        };

        function return_type() {
            var typ = type();
            if (!typ) {
                if (consume(ID, "void")) {
                    return "void";
                }
                else error("No return type");
            }
            return typ;
        };

        function operation() {
            all_ws();
            var ret = {
                type:           "operation"
            ,   getter:         false
            ,   setter:         false
            ,   creator:        false
            ,   deleter:        false
            ,   legacycaller:   false
            ,   "static":       false
            ,   stringifier:    false
            };
            var token;
            do {
                all_ws();
                if (token = consume(ID, "getter")) ret.getter = true;
                else if (token = consume(ID, "setter")) ret.setter = true;
                else if (token = consume(ID, "creator")) ret.creator = true;
                else if (token = consume(ID, "deleter")) ret.deleter = true;
                else if (token = consume(ID, "legacycaller")) ret.legacycaller = true;
            } while (token);
            if (ret.getter || ret.setter || ret.creator || ret.deleter || ret.legacycaller) {
                all_ws();
                ret.idlType = return_type();
                operation_rest(ret);
                return ret;
            }
            if (consume(ID, "static")) {
                ret["static"] = true;
                ret.idlType = return_type();
                operation_rest(ret);
                return ret;
            }
            else if (consume(ID, "stringifier")) {
                ret.stringifier = true;-
                all_ws();
                if (consume(OTHER, ";")) return ret;
                ret.idlType = return_type();
                operation_rest(ret);
                return ret;
            }
            ret.idlType = return_type();
            all_ws();
            if (consume(ID, "iterator")) {
                all_ws();
                ret.type = "iterator";
                if (consume(ID, "object")) {
                    ret.iteratorObject = "object";
                }
                else if (consume(OTHER, "=")) {
                    all_ws();
                    var name = consume(ID) || error("No right hand side in iterator");
                    ret.iteratorObject = name.value;
                }
                all_ws();
                consume(OTHER, ";") || error("Unterminated iterator");
                return ret;
            }
            else {
                operation_rest(ret);
                return ret;
            }
        };

        function identifiers(arr) {
            for (all_ws(); consume(OTHER, ","); all_ws()) {
                all_ws();
                var name = consume(ID) || error("Trailing comma in identifiers list");
                arr.push(name.value);
            }
        };

        function serialiser() {
            all_ws();
            if (!consume(ID, "serializer")) return;
            var ret = { type: "serializer" };
            all_ws();
            if (consume(OTHER, "=")) {
                all_ws();
                if (consume(OTHER, "{")) {
                    ret.patternMap = true;
                    all_ws();
                    var id = consume(ID);
                    if (id && id.value === "getter") {
                        ret.names = ["getter"];
                    }
                    else if (id && id.value === "inherit") {
                        ret.names = ["inherit"];
                        identifiers(ret.names);
                    }
                    else if (id) {
                        ret.names = [id.value];
                        identifiers(ret.names);
                    }
                    else {
                        ret.names = [];
                    }
                    all_ws();
                    consume(OTHER, "}") || error("Unterminated serializer pattern map");
                }
                else if (consume(OTHER, "[")) {
                    ret.patternList = true;
                    all_ws();
                    var id = consume(ID);
                    if (id && id.value === "getter") {
                        ret.names = ["getter"];
                    }
                    else if (id) {
                        ret.names = [id.value];
                        identifiers(ret.names);
                    }
                    else {
                        ret.names = [];
                    }
                    all_ws();
                    consume(OTHER, "]") || error("Unterminated serializer pattern list");
                }
                else {
                    var name = consume(ID) || error("Invalid serializer");
                    ret.name = name.value;
                }
                all_ws();
                consume(OTHER, ";") || error("Unterminated serializer");
                return ret;
            }
            else if (consume(OTHER, ";")) {
                // noop, just parsing
            }
            else {
                ret.idlType = return_type();
                all_ws();
                ret.operation = operation_rest();
            }
            return ret;
        };

        function iterable_type() {
            if (consume(ID, "iterable")) return "iterable";
            else if (consume(ID, "legacyiterable")) return "legacyiterable";
            else if (consume(ID, "maplike")) return "maplike";
            else if (consume(ID, "setlike")) return "setlike";
        }

        function readonly_iterable_type() {
            if (consume(ID, "maplike")) return "maplike";
            else if (consume(ID, "setlike")) return "setlike";
        }

        function iterable() {
            all_ws();
            var grabbed = [],
                ret = {type: null, idlType: null, readonly: false};
            if (consume(ID, "readonly")) {
                ret.readonly = true;
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            var consumeItType = ret.readonly ? readonly_iterable_type : iterable_type;

            var ittype = consumeItType();
            if (!ittype) {
                tokens = grabbed.concat(tokens);
                return;
            }

            var secondTypeRequired = ittype === "maplike";
            var secondTypeAllowed = secondTypeRequired || ittype === "iterable";
            ret.type = ittype;
            if (ret.type !== 'maplike' && ret.type !== 'setlike')
                delete ret.readonly;
            all_ws();
            if (consume(OTHER, "<")) {
                ret.idlType = type() || error("Error parsing " + ittype + " declaration");
                all_ws();
                if (secondTypeAllowed) {
                    var type2 = null;
                    if (consume(OTHER, ",")) {
                        all_ws();
                        type2 = type();
                        all_ws();
                    }
                    if (type2)
                        ret.idlType = [ret.idlType, type2];
                    else if (secondTypeRequired)
                        error("Missing second type argument in " + ittype + " declaration");
                }
                if (!consume(OTHER, ">")) error("Unterminated " + ittype + " declaration");
                all_ws();
                if (!consume(OTHER, ";")) error("Missing semicolon after " + ittype + " declaration");
            }
            else
                error("Error parsing " + ittype + " declaration");

            return ret;
        }

        function interface_(isPartial) {
            all_ws();
            if (!consume(ID, "interface")) return;
            all_ws();
            var name = consume(ID) || error("No name for interface");
            var mems = []
            ,   ret = {
                type:   "interface"
            ,   name:   name.value
            ,   partial:    false
            ,   members:    mems
            };
            if (!isPartial) ret.inheritance = inheritance() || null;
            all_ws();
            consume(OTHER, "{") || error("Bodyless interface");
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("Missing semicolon after interface");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var cnt = const_();
                if (cnt) {
                    cnt.extAttrs = ea;
                    ret.members.push(cnt);
                    continue;
                }
                var mem = (opt.allowNestedTypedefs && typedef()) ||
                          iterable() ||
                          serialiser() ||
                          attribute() ||
                          operation() ||
                          error("Unknown member");
                mem.extAttrs = ea;
                ret.members.push(mem);
            }
        };

        function partial() {
            all_ws();
            if (!consume(ID, "partial")) return;
            var thing = dictionary(true) ||
                        interface_(true) ||
                        error("Partial doesn't apply to anything");
            thing.partial = true;
            return thing;
        };

        function dictionary(isPartial) {
            all_ws();
            if (!consume(ID, "dictionary")) return;
            all_ws();
            var name = consume(ID) || error("No name for dictionary");
            var mems = []
            ,   ret = {
                type:   "dictionary"
            ,   name:   name.value
            ,   partial:    false
            ,   members:    mems
            };
            if (!isPartial) ret.inheritance = inheritance() || null;
            all_ws();
            consume(OTHER, "{") || error("Bodyless dictionary");
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("Missing semicolon after dictionary");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var required = consume(ID, "required");
                var typ = type() || error("No type for dictionary member");
                all_ws();
                var name = consume(ID) || error("No name for dictionary member");
                var dflt = default_();
                if (required && dflt) error("Required member must not have a default");
                var member = {
                    type:       "field"
                ,   name:       name.value
                ,   required:   !!required
                ,   idlType:    typ
                ,   extAttrs:   ea
                };
                if (typeof dflt !== "undefined") {
                    member["default"] = dflt;
                }
                ret.members.push(member);
                all_ws();
                consume(OTHER, ";") || error("Unterminated dictionary member");
            }
        };

        function exception() {
            all_ws();
            if (!consume(ID, "exception")) return;
            all_ws();
            var name = consume(ID) || error("No name for exception");
            var mems = []
            ,   ret = {
                type:   "exception"
            ,   name:   name.value
            ,   members:    mems
            };
            ret.inheritance = inheritance() || null;
            all_ws();
            consume(OTHER, "{") || error("Bodyless exception");
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("Missing semicolon after exception");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var cnt = const_();
                if (cnt) {
                    cnt.extAttrs = ea;
                    ret.members.push(cnt);
                }
                else {
                    var typ = type();
                    all_ws();
                    var name = consume(ID);
                    all_ws();
                    if (!typ || !name || !consume(OTHER, ";")) error("Unknown member in exception body");
                    ret.members.push({
                        type:       "field"
                    ,   name:       name.value
                    ,   idlType:    typ
                    ,   extAttrs:   ea
                    });
                }
            }
        };

        function enum_() {
            all_ws();
            if (!consume(ID, "enum")) return;
            all_ws();
            var name = consume(ID) || error("No name for enum");
            var vals = []
            ,   ret = {
                type:   "enum"
            ,   name:   name.value
            ,   values: vals
            };
            all_ws();
            consume(OTHER, "{") || error("No curly for enum");
            var saw_comma = false;
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("No semicolon after enum");
                    return ret;
                }
                var val = consume(STR) || error("Unexpected value in enum");
                ret.values.push(val.value.replace(/"/g, ""));
                all_ws();
                if (consume(OTHER, ",")) {
                    all_ws();
                    saw_comma = true;
                }
                else {
                    saw_comma = false;
                }
            }
        };

        function typedef() {
            all_ws();
            if (!consume(ID, "typedef")) return;
            var ret = {
                type:   "typedef"
            };
            all_ws();
            ret.typeExtAttrs = extended_attrs();
            all_ws();
            ret.idlType = type() || error("No type in typedef");
            all_ws();
            var name = consume(ID) || error("No name in typedef");
            ret.name = name.value;
            all_ws();
            consume(OTHER, ";") || error("Unterminated typedef");
            return ret;
        };

        function implements_() {
            all_ws();
            var target = consume(ID);
            if (!target) return;
            var w = all_ws();
            if (consume(ID, "implements")) {
                var ret = {
                    type:   "implements"
                ,   target: target.value
                };
                all_ws();
                var imp = consume(ID) || error("Incomplete implements statement");
                ret["implements"] = imp.value;
                all_ws();
                consume(OTHER, ";") || error("No terminating ; for implements statement");
                return ret;
            }
            else {
                // rollback
                tokens.unshift(w);
                tokens.unshift(target);
            }
        };

        function definition() {
            return  callback()        ||
                    interface_(false) ||
                    partial()         ||
                    dictionary(false) ||
                    exception()       ||
                    enum_()           ||
                    typedef()         ||
                    implements_()
                    ;
        };

        function definitions() {
            if (!tokens.length) return [];
            var defs = [];
            var ea;
            var def;
            for (ea = extended_attrs(), def = definition(); def;
                 ea = extended_attrs(), def = definition()) {
                def.extAttrs = ea;
                defs.push(def);
            }
            if (ea.length) error("Stray extended attributes");
            return defs;
        };
        var res = definitions();
        if (tokens.length) error("Unrecognised tokens");
        return res;
    };

    var obj = {
      parse: function(str, opt) {
        if (!opt) opt = {};
        var tokens = tokenise(str);
        return parse(tokens, opt);
      }
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
      module.exports = obj;
    } else if (typeof define === 'function' && define.amd) {
      define([], function(){
        return obj;
      });
    } else {
      (self || window).WebIDL2 = obj;
    }
}());
