import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SaveErrorBanner } from "./SaveErrorBanner.tsx";

describe("SaveErrorBanner", () => {
  it("renders the problem, guidance, resolution error, and actions as an alert", () => {
    const output = renderToStaticMarkup(
      <SaveErrorBanner
        message="The file changed."
        detail="Choose which version to keep."
        resolutionError="Reload failed."
      >
        <button type="button" disabled>Reloading…</button>
      </SaveErrorBanner>,
    );

    expect(output).toContain('role="alert"');
    expect(output).toContain("The file changed.");
    expect(output).toContain("Choose which version to keep.");
    expect(output).toContain("Reload failed.");
    expect(output).toContain("Reloading…");
    expect(output).toContain("disabled");
  });

  it("omits optional sections for a plain save error", () => {
    const output = renderToStaticMarkup(
      <SaveErrorBanner message="Save failed." />,
    );

    expect(output).not.toContain("save-error-banner__detail");
    expect(output).not.toContain("save-error-banner__resolution-error");
    expect(output).not.toContain("save-error-banner__actions");
  });
});
