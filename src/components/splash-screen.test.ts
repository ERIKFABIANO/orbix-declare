import { describe, expect, it } from "vitest";
import { splashProgressAt } from "@/components/splash-screen";

describe("splashProgressAt", () => {
  it("avança continuamente durante o tempo mínimo em vez de parar entre etapas", () => {
    expect(splashProgressAt(0, 5000)).toBe(0);
    expect(splashProgressAt(1250, 5000)).toBe(25);
    expect(splashProgressAt(2500, 5000)).toBe(50);
    expect(splashProgressAt(3750, 5000)).toBe(75);
    expect(splashProgressAt(5000, 5000)).toBe(99);
  });
});
