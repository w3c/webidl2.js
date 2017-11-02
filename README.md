
# WebIDL 2

[![NPM version](https://badge.fury.io/js/webidl2.svg)](http://badge.fury.io/js/webidl2)

## Purpose

This is a parser for the [WebIDL](http://dev.w3.org/2006/webapi/WebIDL/) language. If
you don't know what that is, then you probably don't need it. It is meant to be used
both in Node and in the browser (the parser likely works in other JS environments, but
not the test suite).

## Installation

Just the usual. For Node:

```Bash
npm install webidl2
```

In the browser:

```HTML
<script src='webidl2.js'></script>
```

## Documentation

WebIDL2 provides two functions: `parse` and `write`.

* `parse`: Converts a WebIDL string into a syntax tree.
* `write`: Converts a syntax tree into a WebIDL string. Useful for programmatic code
  modification.

In Node, that happens with:

```JS
var WebIDL2 = require("webidl2");
var tree = WebIDL2.parse("string of WebIDL");
var text = WebIDL2.write(tree);
```

In the browser:
```HTML
<script src='webidl2.js'></script>
<script>
  var tree = WebIDL2.parse("string of WebIDL");
</script>

<script src='writer.js'></script>
<script>
  var text = WebIDL2Writer.write(tree);
</script>
```

### Errors

When there is a syntax error in the WebIDL, it throws an exception object with the following
properties:

* `message`: the error message
* `line`: the line at which the error occurred.
* `input`: a short peek at the text at the point where the error happened
* `tokens`: the five tokens at the point of error, as understood by the tokeniser
  (this is the same content as `input`, but seen from the tokeniser's point of view)

The exception also has a `toString()` method that hopefully should produce a decent
error message.

### AST (Abstract Syntax Tree)

The `parse()` method returns a tree object representing the parse tree of the IDL.
Comment and white space are not represented in the AST.

The root of this object is always an array of definitions (where definitions are
any of interfaces, dictionaries, callbacks, etc. — anything that can occur at the root
of the IDL).

### IDL Type

This structure is used in many other places (operation return types, argument types, etc.).
It captures a WebIDL type with a number of options. Types look like this and are typically
attached to a field called `idlType`:

```JS
{
  "type": "attribute-type",
  "generic": null,
  "idlType": "unsigned short",
  "nullable": null,
  "union": false,
  "baseName": "short",
  "prefix": {
    "value": "unsigned",
    "trivia": " "
  },
  "postfix": null,
  "separator": null,
  "trivia": {
    "base": " "
  },
  "extAttrs": {
    "trivia": {
      "open": "\n",
      "close": ""
    },
    "items": [...]
  }
}
```

Where the fields are as follows:

* `type`: String indicating where this type is used. Can be `null` if not applicable.
* `generic`: An object with the following fields if the type is generic:
  * `value`: String indicating the generic type (e.g. "Promise", "sequence").
  * `trivia`: Whitespaces or comments preceding genenic type name token.
* `idlType`: String indicating the type name, or array of subtypes if the type is
  generic or a union.
* `baseName`: String indicating the base type name, e.g. "float" for "unrestricted
  float".
* `prefix`: An object with the following fields if a prefix exists:
  * `value`: String indicating the prefix name ("unsigned" or "unrestricted").
  * `trivia`: Whitespaces or comments preceding prefix token.
* `postfix`: An object with the following fields if a postfix exists:
  * `value`: String indicating the prefix name, currently only for "unsigned long long".
  * `trivia`: Whitespaces or comments preceding postfix token.
* `separator`: An object with the following fields if a separator follows:
  * `value`: String indicating the separator token value, e.g. "," or "or".
  * `trivia`: Whitespaces or comments preceding separator token.
* `nullable`: An object with a string type field `trivia` if the type is nullable.
* `union`: Boolean indicating whether this is a union type or not.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Trivia

Structures often have `trivia` field that represents whitespaces and comments before tokens. It gives a string if the syntatic component is made of a single token or an object with multiple string type fields.

A trivia object looks like the following example:

```JS
{
  "base": "\n",
  "name": " ",
  "...": "..."
}
```

Frequently, `base` is for type keywords, `name` is for identifiers, `open`/`close` are for brackets, and `termination` for semicolons.

### Interface

Interfaces look like this:

```JS
{
  "type": "interface",
  "name": "Animal",
  "partial": null,
  "members": [...],
  "trivia": {
    "base": "",
    "name": " ",
    "open": " ",
    "close": "\n",
    "termination": ""
  },
  "inheritance": null,
  "extAttrs": [...]
}, {
  "type": "interface",
  "name": "Human",
  "partial": null,
  "members": [...],
  "trivia": {
    "base": "\n\n",
    "name": " ",
    "open": " ",
    "close": "\n",
    "termination": ""
  },
  "inheritance": {
    "name": "Animal",
    "trivia": {
      "colon": " ",
      "name": " "
    }
  },
  "extAttrs": {
    "trivia": {
      "open": "\n\n",
      "close": ""
    },
    "items": [...]
  }
}
```

The fields are as follows:

* `type`: Always "interface".
* `name`: The name of the interface.
* `partial`: If a partial interface, an object with a string type field `trivia`. Otherwise, `null`.
* `members`: An array of interface members (attributes, operations, etc.). Empty if there are none.
* `trivia`: A trivia object.
* `inheritance`: An object giving the name of an interface this one inherits from, `null` otherwise.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Interface mixins

Interfaces mixins look like this:

```JS
{
  "type": "interface mixin",
  "name": "Animal",
  "partial": null,
  "members": [...],
  "trivia": {
    "base": "",
    "mixin": " ",
    "name": " ",
    "open": " ",
    "close": "\n",
    "termination": ""
  },
  "extAttrs": [...]
}, {
  "type": "interface mixin",
  "name": "Human",
  "partial": null,
  "members": [...],
  "trivia": {
    "base": "",
    "mixin": " ",
    "name": " ",
    "open": " ",
    "close": "\n",
    "termination": ""
  },
  "extAttrs": {
    "trivia": {
      "open": "\n\n",
      "close": ""
    },
    "items": [...]
  }
}
```

The fields are as follows:

* `type`: Always "interface mixin".
* `name`: The name of the interface mixin.
* `partial`: If a partial interface mixin, an object with a string type field `trivia`. Otherwise, `null`.
* `members`: An array of interface members (attributes, operations, etc.). Empty if there are none.
* `trivia`: A trivia object.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Namespace

Namespaces look like this:

```JS
{
  "type": "namespace",
  "name": "Console",
  "partial": null,
  "members": [...],
  "trivia": {
    "base": "",
    "name": " ",
    "open": " ",
    "close": "\n",
    "termination": ""
  },
  "extAttrs": {
    "trivia": {
      "open": "\n\n",
      "close": ""
    },
    "items": [...]
  }
}
```

The fields are as follows:

* `type`: Always "namespace".
* `name`: The name of the namespace.
* `partial`: If a partial namespace, an object with a string type field `trivia`. Otherwise, `null`.
* `members`: An array of namespace members (attributes and operations). Empty if there are none.
* `trivia`: A trivia object.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Callback Interfaces

These are captured by the same structure as [Interfaces](#interface) except that
their `type` field is "callback interface". Its trivia object additionally
includes a new field `callback`.

### Callback

A callback looks like this:

```JS
{
  "type": "callback",
  "name": "AsyncOperationCallback",
  "idlType": {
    "type": "return-type",
    "generic": null,
    "nullable": null,
    "union": false,
    "idlType": "void",
    "baseName": "void",
    "prefix": null,
    "postfix": null,
    "separator": null,
    "extAttrs": null,
    "trivia": {
      "base": " "
    }
  },
  "arguments": [...],
  "trivia": {
    "base": "",
    "name": " ",
    "assign": " ",
    "open": " ",
    "close": "",
    "termination": ""
  },
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "callback".
* `name`: The name of the callback.
* `idlType`: An [IDL Type](#idl-type) describing what the callback returns.
* `arguments`: A list of [arguments](#arguments), as in function paramters.
* `trivia`: A trivia object. The field `assign` is for the equal sign token.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Dictionary

A dictionary looks like this:

```JS
{
  "type": "dictionary",
  "name": "PaintOptions",
  "partial": null,
  "members": [{
    "type": "field",
    "name": "fillPattern",
    "escapedName": "fillPattern",
    "required": null,
    "idlType": {
      "type": "dictionary-type",
      "generic": null,
      "nullable": {
        "trivia": ""
      },
      "union": false,
      "idlType": "DOMString",
      "baseName": "DOMString",
      "prefix": null,
      "postfix": null,
      "separator": null,
      "extAttrs": [...],
      "trivia": {
        "base": "\n  "
      }
    },
    "extAttrs": null,
    "default": {
      "type": "string",
      "value": "black",
      "trivia": {
        "assign": " ",
        "value": " "
      }
    }
  }],
  "trivia": {
    "base": "// Extracted from Web IDL editors draft May 31 2011\n",
    "name": " ",
    "open": " ",
    "close": "\n",
    "termination": ""
  },
  "inheritance": null,
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "dictionary".
* `name`: The dictionary name.
* `escapedName`: The dictionary name including possible escaping underscore.
* `partial`: If the type is a partial dictionary, an object with a string type field `trivia`. Otherwise, `null`.
* `members`: An array of members (see below).
* `trivia`: A trivia object.
* `inheritance`: An object indicating which dictionary is being inherited from, `null` otherwise.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

All the members are fields as follows:

* `type`: Always "field".
* `name`: The name of the field.
* `required`: If the field is required, an object with a string type field `trivia`. Otherwise, `null`.
* `idlType`: An [IDL Type](#idl-type) describing what field's type.
* `extAttrs`: An [extended attributes](#extended-attributes) container.
* `default`: A [default value](#default-and-const-values), absent if there is none.

### Enum

An enum looks like this:

```JS
{
  "type": "enum",
  "name": "MealType",
  "values": [
    {
      "type": "string",
      "value": "rice",
      "trivia": " ",
      "separator": {
        "value": ",",
        "trivia": ""
      }
    },
    {
      "type": "string",
      "value": "noodles",
      "trivia": " ",
      "separator": {
        "value": ",",
        "trivia": ""
      }
    },
    {
      "type": "string",
      "value": "other",
      "trivia": " ",
      "separator": null
    }
  ],
  "trivia": {
    "base": "",
    "name": " ",
    "open": " ",
    "close": " ",
    "termination": ""
  },
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "enum".
* `name`: The enum's name.
* `values`: An array of values, which may include a field `separator` for proceding commas.
* `trivia`: A trivia object.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Typedef

A typedef looks like this:

```JS
{
  "type": "typedef",
  "idlType": {
    "type": "typedef-type",
    "generic": "sequence",
    "nullable": false,
    "union": false,
    "idlType": [
      {
        "type": "typedef-type",
        "generic": null,
        "nullable": null,
        "union": false,
        "idlType": "Point",
        "baseName": "Point",
        "prefix": null,
        "postfix": null,
        "separator": null,
        "extAttrs": [...]
        "trivia": {
            "base": ""
        }
      }
    ],
    "extAttrs": [...]
  },
  "name": "PointSequence",
  "trivia": {
    "base": "\n\n      ",
    "name": " ",
    "termination": ""
  },
  "extAttrs": null
}
```


The fields are as follows:

* `type`: Always "typedef".
* `name`: The typedef's name.
* `idlType`: An [IDL Type](#idl-type) describing what typedef's type.
* `trivia`: A trivia object.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Includes

An includes definition looks like this:

```JS
{
  "type": "includes",
  "target": "Node",
  "includes": "EventTarget",
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "includes".
* `target`: The interface that includes an interface mixin.
* `includes`: The interface mixin that is being included by the target.
* `trivia`: A trivia object. The field `target` is for the base interface identifier, `includes` for the `includes` keyword, and `mixin` for the mixin identifier.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Operation Member

An operation looks like this:
```JS
{
  "type": "operation",
  "getter": null,
  "setter": null,
  "deleter": null,
  "static": null,
  "stringifier": null,
  "body": {
    "idlType": {
      "type": "return-type",
      "generic": null,
      "nullable": null,
      "union": false,
      "idlType": "void",
      "baseName": "void",
      "prefix": null,
      "postfix": null,
      "separator": null,
      "extAttrs": null,
      "trivia": {
        "base": "\n  "
      }
    },
    "trivia": {
      "open": "",
      "close": ""
    },
    "name": {
      "value": "intersection",
      "escaped": "intersection",
      "trivia": " "
    },
    "arguments": [{
      "optional": false,
      "variadic": true,
      "extAttrs": null,
      "idlType": {
        "type": "argument-type",
        "generic": null,
        "nullable": false,
        "union": false,
        "idlType": "long",
        "extAttrs": [...]
      },
      "name": "ints"
    }],
  },
  "trivia": {
    "termination": ""
  },
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "operation".
* `getter`: If a getter operation, an object with a string type field `trivia`. Otherwise, `null`.
* `setter`: If a setter operation, an object with a string type field `trivia`. Otherwise, `null`.
* `deleter`: If a deleter operation, an object with a string type field `trivia`. Otherwise, `null`.
* `static`: If a static operation, an object with a string type field `trivia`. Otherwise, `null`.
* `stringifier`: If a stringifier operation, an object with a string type field `trivia`. Otherwise, `null`.
* `trivia`: A trivia object.
* `body`: The operation body. Can be null if bodyless `stringifier`.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

The operation body fields are as follows:

* `idlType`: An [IDL Type](#idl-type) of what the operation returns.
* `trivia`: A trivia object.
* `name`: The name of the operation if exists.
* `arguments`: An array of [arguments](#arguments) for the operation.

### Attribute Member

An attribute member looks like this:

```JS
{
  "type": "attribute",
  "static": null,
  "stringifier": null,
  "inherit": null,
  "readonly": null,
  "trivia": {
    "base": "",
    "name": " ",
    "termination": ""
  },
  "idlType": {
    "type": "attribute-type",
    "generic": null,
    "nullable": null,
    "union": false,
    "idlType": "any",
    "baseName": "any",
    "prefix": null,
    "postfix": null,
    "separator": null,
    "extAttrs": [...],
    "trivia": {
      "base": " "
    }
  },
  "name": "regexp",
  "escapedName": "regexp",
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "attribute".
* `name`: The attribute's name.
* `escapedName`: The attribute's name including possible escaping underscore.
* `static`: If it's a static attribute, an object with a string type field `trivia`. Otherwise, `null`.
* `stringifier`: If it's a stringifier attribute, an object with a string type field `trivia`. Otherwise, `null`.
* `inherit`: If it's an inherit attribute, an object with a string type field `trivia`. Otherwise, `null`.
* `readonly`: If it's a read-only attribute, an object with a string type field `trivia`. Otherwise, `null`.
* `trivia`: A trivia object.
* `idlType`: An [IDL Type](#idl-type) for the attribute.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Constant Member

A constant member looks like this:

```JS
{
  "type": "const",
  "idlType": {
    "type": "const-type",
    "generic": null,
    "nullable": null,
    "union": false,
    "idlType": "boolean",
    "baseName": "boolean",
    "prefix": null,
    "postfix": null,
    "separator": null,
    "extAttrs": null,
    "trivia": {
      "base": " "
    }
  },
  "name": "DEBUG",
  "value": {
    "type": "boolean",
    "value": false
  },
  "trivia": {
    "base": "\n  ",
    "name": " ",
    "assign": " ",
    "value": " ",
    "termination": ""
  },
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always "const".
* `idlType`: An [IDL Type](#idl-type) of the constant that represents a simple type, the type name.
* `name`: The name of the constant.
* `value`: The constant value as described by [Const Values](#default-and-const-values)
* `trivia`: A trivia object. The field `assign` is for the equal sign token.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Arguments

The arguments (e.g. for an operation) look like this:

```JS
{
  "arguments": [{
    "optional": null,
    "variadic": {
      "trivia": ""
    },
    "extAttrs": null,
    "trivia": {
      "name": " "
    },
    "idlType": {
      "type": "argument-type",
      "generic": null,
      "nullable": null,
      "union": false,
      "idlType": "float",
      "baseName": "float",
      "prefix": null,
      "postfix": null,
      "separator": null,
      "extAttrs": [...],
      "trivia": {
        "base": " "
      }
    },
    "name": "ints",
    "escapedName": "ints",
    "separator": {
      "value": ",",
      "trivia": ""
    }
  }]
}
```

The fields are as follows:

* `optional`: If the argument is optional, an object with a string type field `trivia`. Otherwise, `null`.
* `variadic`: If the argument is variadic, an object with a string type field `trivia`. Otherwise, `null`.
* `idlType`: An [IDL Type](#idl-type) describing the type of the argument.
* `name`: The argument's name.
* `escapedName`: The argument's name including possible escaping underscore.
* `separator`: An object with the following fields if a separator follows:
  * `value`: Always ",".
  * `trivia`: Whitespaces or comments preceding separator token.
* `trivia`: A trivia object.
* `extAttrs`: An [extended attributes](#extended-attributes) container.

### Extended Attributes

Extended attribute container look like this:

```JS
{
  "extAttrs": {
    "trivia": {
      "open": "\n\n",
      "close": ""
    },
    "items": [{
      "name": "TreatNullAs",
      "signature": {
        "arguments": [...],
        "trivia": {
          "open": "",
          "close": ""
        }
      },
      "type": "extended-attribute",
      "rhs": {
        "type": "identifier",
        "value": "EmptyString",
        "trivia": {
          "assign": "",
          "value": ""
        }
      },
      "trivia": {
        "name": ""
      },
      "separator": null
    }]
  }
}
```

The fields are as follows:

* `trivia`: A trivia object.
* `items`: An array of extended attributes.

Extended attributes look like this:

* `name`: The extended attribute's name.
* `signature`: An object containing trivia and [arguments](#arguments), if the extended
  attribute has a signature (e.g. `[Foo()]`) or if its right-hand side does (e.g.
  `[NamedConstructor=Name(DOMString blah)]`).
* `type`: Always `"extended-attribute"`.
* `rhs`: If there is a right-hand side, this will capture its `type` (which can be
  "identifier" or "identifier-list"), its `value`, and its preceding trivia.
* `trivia`: A trivia object.
* `separator`: An object with the following fields if a separator follows:
  * `value`: Always ",".
  * `trivia`: Whitespaces or comments preceding separator token.

### Default and Const Values

Dictionary fields and operation arguments can take default values, and constants take
values, all of which have the following fields:

* `type`: One of string, number, boolean, null, Infinity, NaN, or sequence.

For string, number, boolean, and sequence:

* `value`: The value of the given type, as a string. For sequence, the only possible value is `[]`.

For Infinity:

* `negative`: Boolean indicating whether this is negative Infinity or not.

### `iterable<>`, `maplike<>`, `setlike<>` declarations

These appear as members of interfaces that look like this:

```JS
{
  "type": "maplike", // or "iterable" / "setlike"
  "idlType": /* One or two types */ ,
  "readonly": null, // only for maplike and setlike
  "trivia": {
    "base": " ",
    "open": "",
    "close": "",
    "termination": ""
  },
  "extAttrs": null
}
```

The fields are as follows:

* `type`: Always one of "iterable", "maplike" or "setlike".
* `idlType`: An array with one or more [IDL Types](#idl-type) representing the declared type arguments.
* `readonly`: If the maplike or setlike is declared as read only, an object with a string type field `trivia`. Otherwise, `null`.
* `trivia`: A trivia object.
* `extAttrs`: An [extended attributes](#extended-attributes) container.


## Testing

### Running

The test runs with mocha and expect.js. Normally, running mocha in the root directory
should be enough once you're set up.

### Coverage

Current test coverage, as documented in `coverage.html`, is 95%. You can run your own
coverage analysis with:

```Bash
jscoverage lib lib-cov
```

That will create the lib-cov directory with instrumented code; the test suite knows
to use that if needed. You can then run the tests with:

```Bash
JSCOV=1 mocha --reporter html-cov > coverage.html
```

Note that I've been getting weirdly overescaped results from the html-cov reporter,
so you might wish to try this instead:

```Bash
JSCOV=1 mocha  --reporter html-cov | sed "s/&lt;/</g" | sed "s/&gt;/>/g" | sed "s/&quot;/\"/g" > coverage.html
```
### Browser tests

In order to test in the browser, get inside `test/web` and run `make-web-tests.js`. This
will generate a `browser-tests.html` file that you can open in a browser. As of this
writing tests pass in the latest Firefox, Chrome, Opera, and Safari. Testing on IE
and older versions will happen progressively.
