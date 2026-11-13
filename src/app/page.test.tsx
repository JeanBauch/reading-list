import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

// Walking-skeleton test: proves the unit-test toolchain renders an App Router page.
// Replace it when the first ticket gives the home page real behaviour.
test("home page renders a top-level heading", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
});
