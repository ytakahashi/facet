import type { ReactNode } from "react";

export const EXTERNAL_CHANGE_CONFLICT_DETAIL =
  "Reload uses the version on disk and discards your changes in Facet. Overwrite keeps your changes in Facet and replaces the version on disk.";

export interface SaveErrorBannerProps {
  message: string;
  detail?: string;
  resolutionError?: string;
  children?: ReactNode;
}

// Keeps save failures and conflicts visually consistent while leaving each
// caller responsible for the actions and wording its state actually permits.
export function SaveErrorBanner({
  message,
  detail,
  resolutionError,
  children,
}: SaveErrorBannerProps) {
  return (
    <div className="save-error-banner" role="alert">
      <p className="save-error-banner__message">{message}</p>
      {detail && <p className="save-error-banner__detail">{detail}</p>}
      {resolutionError && (
        <p className="save-error-banner__resolution-error">
          {resolutionError}
        </p>
      )}
      {children && <div className="save-error-banner__actions">{children}</div>}
    </div>
  );
}
