import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppTabs } from "./AppTabs";

describe("AppTabs", () => {
  it("renders distinct vault and new tab modes", () => {
    const html = renderToStaticMarkup(
      <AppTabs
        activeId={null}
        homeMode="recent"
        tabs={[]}
        onActivate={() => undefined}
        onClose={() => undefined}
        onNewTab={() => undefined}
        onVaultToggle={() => undefined}
      />,
    );

    expect(html).toContain("Vaults");
    expect(html).toContain("New Tab");
    expect(html).toContain("plus-tab");
    expect(html).toContain("new-tab active");
  });
});
