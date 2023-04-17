import { parse, validate, WebIDLParseError } from "webidl2";
import { join, basename } from "path";
import { readFileSync, readdirSync } from "fs";
import { diff } from "jsondiffpatch";

/**
 * Collects test items from the specified directory
 * @param {string} base
 */
export function* collect(base, { expectError, raw } = {}) {
  const dir = new URL(join("..", base, "idl/"), import.meta.url);
  const idls = readdirSync(dir)
    .filter((it) => it.endsWith(".webidl"))
    .map((it) => new URL(it, dir));

  for (const path of idls) {
    try {
      const text = readFileSync(path, "utf8");
      const ast = parse(text, {
        concrete: true,
        sourceName: basename(path.pathname),
      });
      const validation = validate(ast);
      if (validation) {
        yield new TestItem({ text, ast, path, validation, raw });
      } else {
        yield new TestItem({ text, ast, path, raw });
      }
    } catch (error) {
      if (expectError && error instanceof WebIDLParseError) {
        yield new TestItem({ path, error, raw });
      } else {
        throw error;
      }
    }
  }
}

class TestItem {
  constructor({ text, ast, path, error, validation, raw }) {
    this.text = text;
    this.ast = ast;
    this.path = path;
    this.error = error;
    this.validation = validation;
    const fileExtension = raw ? ".txt" : ".json";
    this.baselinePath = new URL(
      join(
        "../baseline",
        basename(path.pathname).replace(".webidl", fileExtension)
      ),
      path
    );
  }

  readJSON() {
    return JSON.parse(this.readText());
  }

  readText() {
    return readFileSync(this.baselinePath, "utf8");
  }

  diff(target = this.readJSON()) {
    return diff(target, this.ast);
  }
}
