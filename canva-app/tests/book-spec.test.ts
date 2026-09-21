import fs from "node:fs";
import path from "node:path";
import type { BookSpec } from "../src/types/book-spec";
import {
  BookSpecValidationError,
  validateBookSpec,
} from "../src/types/book-spec";

const fixturePath = path.resolve(
  process.cwd(),
  "../test-input/prototype-book.json",
);

const readFixture = (): BookSpec =>
  JSON.parse(fs.readFileSync(fixturePath, "utf8")) as BookSpec;

describe("BookSpec validation", () => {
  it("accepts the prototype page data", () => {
    expect(() => validateBookSpec(readFixture())).not.toThrow();
  });

  it("rejects a missing required chapter title", () => {
    const spec = readFixture();
    const firstPage = spec.pages[0];
    if (!firstPage || firstPage.type !== "chapter-opening") {
      throw new Error("Invalid test fixture");
    }
    firstPage.chapterTitle = " ";

    expect(() => validateBookSpec(spec)).toThrow(BookSpecValidationError);
    expect(() => validateBookSpec(spec)).toThrow("chapterTitle is required");
  });

  it("rejects a flowchart connection with a missing target", () => {
    const spec = readFixture();
    const flowchart = spec.pages[1];
    if (!flowchart || flowchart.type !== "flowchart") {
      throw new Error("Invalid test fixture");
    }
    flowchart.connections[0] = {
      from: "age-input",
      to: "missing-node",
    };

    expect(() => validateBookSpec(spec)).toThrow("references missing node");
  });
});
