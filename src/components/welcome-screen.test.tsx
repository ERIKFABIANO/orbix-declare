import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { WelcomeScreen } from "@/components/welcome-screen";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  ready: null as null | ((loaded: boolean) => void),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, prefetch: vi.fn() }),
}));

vi.mock("@/components/welcome-logo", () => ({
  WelcomeLogo: ({ onReady }: { onReady: (loaded: boolean) => void }) => {
    mocks.ready = onReady;
    return null;
  },
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.replace.mockReset();
    mocks.ready = null;
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("não encerra a animação antes de o modelo informar que terminou de carregar", () => {
    const { container } = render(
      <I18nProvider initialLocale="pt">
        <WelcomeScreen duration={1800} />
      </I18nProvider>,
    );

    act(() => vi.advanceTimersByTime(1800));

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector("main")).toHaveAttribute("data-phase", "loading");
  });
});
