import { TerminalSquare, MoreHorizontal, ChevronDown } from "lucide-react";
import { Incident } from "../lib/types";
import { useState } from "react";
import { getDiagnosisSummaryMarkdown } from "../lib/diagnosisSummary";
import { renderMarkdownBlocks } from "../lib/renderMarkdown";

export const IncidentCard = ({
  incident,
  onReview,
}: {
  incident: Incident;
  onReview: () => void;
  isLast?: boolean;
}) => {
  const [expanded, setExpanded] = useState(
    incident.status === "issue" || incident.status === "resolving",
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid var(--borderColor)",
      }}
      className="ts-row-hover"
    >
      {/* Table Row Style Header matching the new Dashboard grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(250px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) 40px",
          alignItems: "center",
          padding: "1.25rem 1rem",
          cursor: "pointer",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--bg-surface)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        onClick={() => setExpanded(!expanded)}
      >
        {/* Name Column */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "var(--text-primary)",
              }}
            >
              {incident.service.toLowerCase().replace(/\s+/g, "-")}
            </span>
          </div>
          <span
            style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
          >
            emen3998@gmail.com
          </span>

          <div
            style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem" }}
          >
            <span
              style={{
                fontSize: "0.625rem",
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "var(--text-secondary)",
                padding: "0.125rem 0.375rem",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              Expiry disabled
            </span>
            {incident.status !== "online" && (
              <span
                style={{
                  fontSize: "0.625rem",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  color: "#FCA5A5",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                Action Required
              </span>
            )}
          </div>
        </div>

        {/* IP Column */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
          }}
        >
          <span>
            {incident.id === "inc-012" ? "100.89.33.114" : "100.100.6.57"}
          </span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </div>

        {/* Version Column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
          }}
        >
          <span
            style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
          >
            <span
              style={{
                color:
                  incident.status === "issue"
                    ? "var(--status-issue)"
                    : "var(--text-muted)",
              }}
            >
              {incident.status === "issue" ? "!" : "+"}
            </span>
            1.94.2
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            Linux 6.8.0-generic
          </span>
        </div>

        {/* Last Seen Column */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.8125rem",
          }}
        >
          <span
            className={`status-dot ${incident.status === "online" ? "online" : incident.status}`}
          ></span>
          <span
            style={{
              color:
                incident.status === "online"
                  ? "var(--text-primary)"
                  : incident.status === "issue"
                    ? "var(--status-issue)"
                    : "var(--text-primary)",
            }}
          >
            {incident.status === "resolving"
              ? "Diagnosing"
              : incident.status === "issue"
                ? "Offline (Down)"
                : "Connected"}
          </span>
        </div>

        {/* Action Column */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          <MoreHorizontal size={18} />
        </div>
      </div>

      {/* Agent Output - Extends from the row when there's an issue */}
      {expanded &&
        (incident.status === "issue" || incident.status === "resolving") && (
          <div
            style={{
              padding: "0 1rem 1.5rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              backgroundColor: "rgba(255,255,255,0.01)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "1rem",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <TerminalSquare size={16} color="var(--accent-text)" /> AI
                Diagnostic Stream
              </h4>
            </div>

            <div
              style={{
                backgroundColor: "#000000",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                fontFamily:
                  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: "0.8125rem",
                color: "#E5E7EB",
                border: "1px solid #333",
              }}
            >
              <div className="flex-col gap-1.5">
                {incident.logs.map((log: string, i: number) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: "0.75rem", lineHeight: 1.6 }}
                  >
                    <span style={{ color: "#60A5FA", userSelect: "none" }}>
                      $
                    </span>
                    <span style={{ color: "#D4D4D8" }}>{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {incident.proposedFix && (
              <div
                style={{
                  border: "1px solid var(--borderColor)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.5rem",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: "300px" }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "0.375rem",
                    }}
                  >
                    Auto-Healer Plan Ready
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      maxHeight: "220px",
                      overflow: "hidden",
                    }}
                  >
                    {renderMarkdownBlocks(
                      getDiagnosisSummaryMarkdown(incident),
                      5,
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReview();
                    }}
                  >
                    Review Suggestions
                  </button>
                  <button
                    className="btn gh the btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(false);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default IncidentCard;
