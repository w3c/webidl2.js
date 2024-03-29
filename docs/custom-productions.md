# Custom productions

webidl2.js support custom productions for certain Web IDL implentations (e.g. Gecko) to take advantage of our rich feature set.

```js
webidl2.write(ast, {
  productions: [...] // An array with custom production functions
});
```

The productions field lets the parser to call the production functions inside the array before calling the library's own ones. The API for such functions looks like the following:

```ts
declare function factory(
  tokeniser: Tokeniser
): {
  /* ... whatever fields you want to add for your custom object ... */

  write? (w: Writer) => any; // required only for webidl2.write()
};
```

The tokeniser object has the following form:

```ts
type TokenType =
  | "decimal"
  | "integer"
  | "identifier"
  | "string"
  | "whitespace"
  | "comment"
  | "other";

interface Tokeniser {
  /**
   * Current position.
   */
  position: number;

  /**
   * Tokenises
   */
  constructor(idl: string);
  /**
   * Throws WebIDLParseError at the current position.
   */
  error(message: string): never;
  /**
   * Checks whether a token exists without consuming it.
   */
  probeKind(type: TokenType): boolean;
  /**
   * Checks whether an inline token exists without consuming it.
   * @example `probe("interface")`
   */
  probe(value): boolean;
  /**
   * Consumes a token if exists, or returns null.
   * Pass multiple token types to consume one of them.
   */
  consumeKind(...candidates: TokenType[]);
  /**
   * Consumes an inline token if exists, or returns null.
   * Pass multiple token types to consume one of them.
   * @example `consume("getter", "setter", "deleter")`
   */
  consume(...candidates: string[]);
  /**
   * Consumes an identifier token that matches the value.
   * Use this when you need to consume a custom token.
   * @example `consumeIdentifier("legacycaller")`
   */
  consumeIdentifier(value: string);
  /**
   * Seeks to the position.
   */
  unconsume(position: number);
}
```

## Using existing productions

This library exposes member productions in `webidl2/productions`. (Note that this only works with ES module import)

* `Argument`
* `Attribute`
* `Base`
* `Constant`
* `Constructor`
* `Container`
* `Default`
* `ExtendedAttributes` / `SimpleExtendedAttribute`
* `Field`
* `IterableLike`
* `Operation`
* `Type`

You can call `Argument.parse(tokeniser)` inside your custom production to reuse it.

It also exposes some helper functions:

* `autoParenter`: This wraps your object in a proxy that assigns any object's `parent` field to `this`. Useful when tracking the parent of member productions.

   ```js
   const ret = autoParenter(this);
   ret.default = Default.parse(tokeniser);
   default.parent // this
   ```

* `argument_list`: Receives a tokeniser object and parses arguments separated by commas. Can be used to implement function-like syntax.
* `unescape`: Trims preceding underscore `_` if the string argument has one.
