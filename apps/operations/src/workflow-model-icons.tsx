import type { SVGProps } from "react";

export type WorkflowModelIconName =
  | "WORK_INTAKE"
  | "LEAD_SURVEY"
  | "SALES_QUOTATION"
  | "PROJECT_INSTALLATION"
  | "HANDOVER"
  | "AMC_SERVICE";

type Props = Omit<SVGProps<SVGSVGElement>, "aria-label"> & {
  name: WorkflowModelIconName;
  size?: number;
  label?: string;
};

export function WorkflowModelIcon({
  name,
  size = 20,
  label,
  className,
  ...props
}: Props) {
  return (
    <svg
      {...props}
      className={["workflow-model-icon", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    >
      {name === "WORK_INTAKE" && (
        <>
          <path
            d="M4 8.5h16v9.25A2.25 2.25 0 0 1 17.75 20H6.25A2.25 2.25 0 0 1 4 17.75V8.5Z"
            strokeWidth="1.8"
          />
          <path
            d="M7 8.5 8.4 5h7.2L17 8.5M12 3v7m0 0-2.5-2.5M12 10l2.5-2.5"
            strokeWidth="1.8"
          />
        </>
      )}
      {name === "LEAD_SURVEY" && (
        <>
          <path
            d="M12 20s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="10" r="1.8" strokeWidth="1.8" />
          <path
            d="m16.3 16.3 3.5 3.5m-1.6-5.3a3.7 3.7 0 1 1-7.4 0 3.7 3.7 0 0 1 7.4 0Z"
            strokeWidth="1.6"
          />
        </>
      )}
      {name === "SALES_QUOTATION" && (
        <>
          <path
            d="M6 3.5h8l4 4V20.5H6V3.5Z"
            strokeWidth="1.8"
          />
          <path d="M14 3.5v4h4M9 11h6M9 14h6M9 17h3" strokeWidth="1.8" />
          <path d="M4 7.5v13h10" strokeWidth="1.4" opacity=".65" />
        </>
      )}
      {name === "PROJECT_INSTALLATION" && (
        <>
          <path d="M5 20V6.5L12 3l7 3.5V20" strokeWidth="1.8" />
          <path d="M9 20V9h6v11M10.5 12h3M10.5 15h3" strokeWidth="1.8" />
          <path d="M3 20h18" strokeWidth="1.8" />
        </>
      )}
      {name === "HANDOVER" && (
        <>
          <path d="M5 4.5h9l3 3V17a2 2 0 0 1-2 2H5V4.5Z" strokeWidth="1.8" />
          <path d="M14 4.5v3h3M8 11.5l2.2 2.2 4.3-4.3" strokeWidth="1.8" />
          <path d="M14 16h6m0 0-2.4-2.4M20 16l-2.4 2.4" strokeWidth="1.8" />
        </>
      )}
      {name === "AMC_SERVICE" && (
        <>
          <path d="M7 7.2a7.5 7.5 0 0 1 10.9 1.1M17 16.8a7.5 7.5 0 0 1-10.9-1.1" strokeWidth="1.8" />
          <path d="m17.8 5.5.1 3.4-3.3-.3M6.2 18.5l-.1-3.4 3.3.3" strokeWidth="1.8" />
          <rect x="9" y="9" width="6" height="7" rx=".8" strokeWidth="1.6" />
          <path d="M10.5 11h3M10.5 13h3" strokeWidth="1.4" />
        </>
      )}
    </svg>
  );
}

export function workflowModelIconForStage(stage?: string): WorkflowModelIconName {
  const normalized = String(stage || "").toUpperCase();
  if (["INTAKE", "WORK_INTAKE"].includes(normalized)) return "WORK_INTAKE";
  if (["LEAD", "SURVEY", "REQUIREMENTS", "LEAD_SURVEY"].includes(normalized)) return "LEAD_SURVEY";
  if (["QUOTATION", "APPROVAL", "SALES_QUOTATION", "COMMERCIAL"].includes(normalized)) return "SALES_QUOTATION";
  if (["PROJECT", "PROJECT_INSTALLATION", "INSTALLATION"].includes(normalized)) return "PROJECT_INSTALLATION";
  if (["HANDOVER", "CUSTODY"].includes(normalized)) return "HANDOVER";
  return "AMC_SERVICE";
}
