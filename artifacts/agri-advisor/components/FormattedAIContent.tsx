import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Polyline,
  Rect,
  Stop,
} from "react-native-svg";
import { Colors } from "@/constants/colors";

type InlineChunk = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

type StatItem = {
  label: string;
  value: string;
};

type MessageBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; marker: string; text: string }
  | { type: "divider" }
  | { type: "stats"; items: StatItem[] }
  | { type: "table"; headers: string[]; rows: string[][] };

type Props = {
  content: string;
  variant?: "bubble" | "panel";
  accentColor?: string;
};

type NumericColumnInsight = {
  index: number;
  header: string;
  values: number[];
};

function normalizeInlineMarkdown(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");
}

function parseInlineChunks(text: string): InlineChunk[] {
  const normalized = normalizeInlineMarkdown(text);
  const parts = normalized
    .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
    .filter(Boolean);

  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { text: part.slice(2, -2), bold: true };
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return { text: part.slice(1, -1), italic: true };
    }
    return { text: part };
  });
}

function renderInlineText(
  text: string,
  textStyle: any,
  boldStyle: any,
  keyPrefix: string
) {
  return parseInlineChunks(text).map((chunk, index) => (
    <Text
      key={`${keyPrefix}-${index}`}
      style={[
        textStyle,
        chunk.bold ? boldStyle : null,
        chunk.italic ? styles.italicText : null,
      ]}
    >
      {chunk.text}
    </Text>
  ));
}

function isTableLine(line: string): boolean {
  return /^\|.+\|$/.test(line.trim());
}

function isTableDivider(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseStatLine(line: string): StatItem | null {
  const normalized = line.replace(/^\*\*([^*]+)\*\*:\s*/, "$1: ").trim();
  const match = normalized.match(/^([\p{L}][\p{L}\p{N} /()%+.-]{1,40}):\s+(.+)$/u);

  if (!match) return null;
  if (match[2].startsWith("http")) return null;

  return {
    label: match[1].trim(),
    value: match[2].trim(),
  };
}

function parseNumericValue(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreNumericHeader(header: string): number {
  const lower = header.toLowerCase();
  if (lower.includes("rain") || lower.includes("precip")) return 100;
  if (lower.includes("modal") || lower.includes("price") || lower.includes("rate")) return 95;
  if (lower.includes("max")) return 80;
  if (lower.includes("temp") || lower.includes("temperature")) return 78;
  if (lower.includes("min")) return 72;
  if (lower.includes("wind")) return 64;
  if (lower.includes("uv")) return 56;
  return 20;
}

function getNumericColumnInsight(headers: string[], rows: string[][]): NumericColumnInsight | null {
  const candidates: NumericColumnInsight[] = headers
    .map((header, index) => {
      const values = rows
        .map((row) => parseNumericValue(row[index] ?? ""))
        .filter((value): value is number => value !== null);
      return { index, header, values };
    })
    .filter((candidate) => candidate.index > 0 && candidate.values.length >= Math.max(2, rows.length - 1));

  if (!candidates.length) return null;

  return candidates.sort((a, b) => scoreNumericHeader(b.header) - scoreNumericHeader(a.header))[0];
}

function clampLabel(label: string): string {
  return label.length <= 10 ? label : `${label.slice(0, 9)}…`;
}

function buildBlocks(content: string): MessageBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MessageBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
    paragraphBuffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }

    const stat = parseStatLine(line);
    if (stat) {
      const statItems = [stat];
      let nextIndex = i + 1;

      while (nextIndex < lines.length) {
        const nextLine = lines[nextIndex].trim();
        if (!nextLine) break;
        const nextStat = parseStatLine(nextLine);
        if (!nextStat) break;
        statItems.push(nextStat);
        nextIndex += 1;
      }

      if (statItems.length >= 2) {
        flushParagraph();
        blocks.push({ type: "stats", items: statItems });
        i = nextIndex - 1;
        continue;
      }
    }

    if (isTableLine(line)) {
      flushParagraph();
      const tableLines: string[] = [];

      while (i < lines.length && isTableLine(lines[i].trim())) {
        const candidate = lines[i].trim();
        if (!isTableDivider(candidate)) {
          tableLines.push(candidate);
        }
        i += 1;
      }
      i -= 1;

      if (tableLines.length >= 2) {
        blocks.push({
          type: "table",
          headers: parseTableRow(tableLines[0]),
          rows: tableLines.slice(1).map(parseTableRow),
        });
        continue;
      }

      paragraphBuffer.push(...tableLines);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({ type: "bullet", text: bulletMatch[1].trim() });
      continue;
    }

    const numberedMatch = line.match(/^(\d+\.)\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      blocks.push({
        type: "numbered",
        marker: numberedMatch[1],
        text: numberedMatch[2].trim(),
      });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}

function renderTableVisualization(
  headers: string[],
  rows: string[][],
  accentColor: string,
  tableCardStyle: any,
  variant: "bubble" | "panel",
  blockIndex: number
) {
  const primaryMetric = getNumericColumnInsight(headers, rows);
  if (!primaryMetric) return null;

  const minValue = Math.min(...primaryMetric.values);
  const maxValue = Math.max(...primaryMetric.values);
  const averageValue =
    primaryMetric.values.reduce((sum, value) => sum + value, 0) / primaryMetric.values.length;
  const range = Math.max(maxValue - minValue, 1);

  const chartWidth = 240;
  const chartHeight = 96;
  const horizontalPadding = 12;
  const verticalPadding = 14;
  const chartBottom = chartHeight - verticalPadding;
  const chartTop = verticalPadding;
  const step =
    primaryMetric.values.length > 1
      ? (chartWidth - horizontalPadding * 2) / (primaryMetric.values.length - 1)
      : 0;

  const points = primaryMetric.values
    .map((value, index) => {
      const x = horizontalPadding + step * index;
      const y =
        chartBottom - ((value - minValue) / range) * (chartBottom - chartTop);
      return { x, y, value };
    });

  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const insightCards = [
    { label: "Peak", value: `${maxValue}` },
    { label: "Avg", value: `${averageValue.toFixed(1)}` },
    { label: "Range", value: `${(maxValue - minValue).toFixed(1)}` },
  ];
  const labelStyle = variant === "panel" ? styles.chartLabelPanel : styles.chartLabelBubble;

  return (
    <View style={[styles.visualCard, tableCardStyle]} key={`chart-${blockIndex}`}>
      <View style={styles.visualHeader}>
        <Text style={styles.visualTitle}>{primaryMetric.header} trend</Text>
        <View style={[styles.visualPill, { backgroundColor: accentColor + "16" }]}>
          <Text style={[styles.visualPillText, { color: accentColor }]}>
            {primaryMetric.values.length} points
          </Text>
        </View>
      </View>

      <View style={styles.metricStrip}>
        {insightCards.map((item) => (
          <View key={item.label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Defs>
          <LinearGradient id={`chartGradient-${blockIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity="0.42" />
            <Stop offset="100%" stopColor={accentColor} stopOpacity="0.06" />
          </LinearGradient>
        </Defs>

        {[0, 1, 2].map((gridLine) => {
          const y = chartTop + ((chartBottom - chartTop) / 2) * gridLine;
          return (
            <Line
              key={`grid-${gridLine}`}
              x1={horizontalPadding}
              y1={y}
              x2={chartWidth - horizontalPadding}
              y2={y}
              stroke={Colors.surfaceBorder}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          );
        })}

        {points.map((point, index) => (
          <Rect
            key={`bar-${index}`}
            x={point.x - 8}
            y={point.y}
            width={16}
            height={chartBottom - point.y}
            rx={6}
            fill={`url(#chartGradient-${blockIndex})`}
          />
        ))}

        <Polyline
          points={pointString}
          fill="none"
          stroke={accentColor}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={Colors.background}
            stroke={accentColor}
            strokeWidth={2}
          />
        ))}
      </Svg>

      <View style={styles.chartLabels}>
        {rows.map((row, rowIndex) => (
          <Text key={`label-${rowIndex}`} style={labelStyle}>
            {clampLabel(row[0] || `Row ${rowIndex + 1}`)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function FormattedAIContent({
  content,
  variant = "bubble",
  accentColor = Colors.primaryLight,
}: Props) {
  const blocks = buildBlocks(content);
  const headingStyle = variant === "panel" ? styles.panelHeading : styles.bubbleHeading;
  const subheadingStyle = variant === "panel" ? styles.panelSubheading : styles.bubbleSubheading;
  const paragraphStyle = variant === "panel" ? styles.panelText : styles.bubbleText;
  const tableCardStyle = variant === "panel" ? styles.panelTableCard : styles.bubbleTableCard;
  const listMarkerColor = { color: accentColor };

  return (
    <View style={styles.body}>
      {blocks.map((block, index) => {
        const blockSpacing = index === blocks.length - 1 ? null : styles.blockSpacing;

        if (block.type === "heading") {
          const currentHeadingStyle = block.level <= 2 ? headingStyle : subheadingStyle;
          return (
            <Text key={`heading-${index}`} style={[currentHeadingStyle, blockSpacing]}>
              {renderInlineText(
                block.text,
                currentHeadingStyle,
                styles.boldText,
                `heading-${index}`
              )}
            </Text>
          );
        }

        if (block.type === "stats") {
          return (
            <View key={`stats-${index}`} style={[styles.statsGrid, blockSpacing]}>
              {block.items.map((item) => (
                <View key={`${item.label}-${item.value}`} style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {renderInlineText(
                      item.value,
                      styles.statValue,
                      styles.boldText,
                      `stat-value-${index}-${item.label}`
                    )}
                  </Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === "bullet") {
          return (
            <View key={`bullet-${index}`} style={[styles.listRow, blockSpacing]}>
              <Text style={[styles.listMarker, listMarkerColor]}>*</Text>
              <Text style={paragraphStyle}>
                {renderInlineText(block.text, paragraphStyle, styles.boldText, `bullet-${index}`)}
              </Text>
            </View>
          );
        }

        if (block.type === "numbered") {
          return (
            <View key={`numbered-${index}`} style={[styles.listRow, blockSpacing]}>
              <Text style={[styles.numberMarker, listMarkerColor]}>{block.marker}</Text>
              <Text style={paragraphStyle}>
                {renderInlineText(
                  block.text,
                  paragraphStyle,
                  styles.boldText,
                  `numbered-${index}`
                )}
              </Text>
            </View>
          );
        }

        if (block.type === "divider") {
          return <View key={`divider-${index}`} style={[styles.divider, blockSpacing]} />;
        }

        if (block.type === "table") {
          const primaryMetric = getNumericColumnInsight(block.headers, block.rows);

          return (
            <View key={`table-${index}`} style={blockSpacing}>
              {renderTableVisualization(
                block.headers,
                block.rows,
                accentColor,
                tableCardStyle,
                variant,
                index
              )}

              {block.rows.map((row, rowIndex) => {
                const title = row[0];
                const details = row.slice(1);

                return (
                  <View key={`table-row-${rowIndex}`} style={tableCardStyle}>
                    {!!title && (
                      <View style={styles.tableTitleRow}>
                        <Text style={styles.tableCardTitle}>
                          {renderInlineText(
                            title,
                            styles.tableCardTitle,
                            styles.boldText,
                            `table-title-${index}-${rowIndex}`
                          )}
                        </Text>
                        {primaryMetric ? (
                          <View
                            style={[
                              styles.rowValuePill,
                              { backgroundColor: accentColor + "14", borderColor: accentColor + "33" },
                            ]}
                          >
                            <Text style={[styles.rowValuePillText, { color: accentColor }]}>
                              {row[primaryMetric.index] ?? "-"}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {details.map((value, valueIndex) => {
                      const label = block.headers[valueIndex + 1] || `Item ${valueIndex + 2}`;
                      const numericValue = parseNumericValue(value);
                      const maxMetricValue =
                        primaryMetric && label === primaryMetric.header
                          ? Math.max(...primaryMetric.values)
                          : null;
                      const fillRatio =
                        numericValue !== null && maxMetricValue && maxMetricValue > 0
                          ? Math.max(0.08, Math.min(1, numericValue / maxMetricValue))
                          : null;

                      return (
                        <View key={`table-cell-${rowIndex}-${valueIndex}`} style={styles.tableField}>
                          <View style={styles.tableFieldHeader}>
                            <Text style={styles.tableFieldLabel}>{label}</Text>
                            <Text style={styles.tableFieldValue}>
                              {renderInlineText(
                                value,
                                styles.tableFieldValue,
                                styles.boldText,
                                `table-value-${index}-${rowIndex}-${valueIndex}`
                              )}
                            </Text>
                          </View>

                          {fillRatio !== null ? (
                            <View style={styles.inlineBarTrack}>
                              <View
                                style={[
                                  styles.inlineBarFill,
                                  {
                                    width: `${fillRatio * 100}%`,
                                    backgroundColor: accentColor,
                                  },
                                ]}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        }

        return (
          <Text key={`paragraph-${index}`} style={[paragraphStyle, blockSpacing]}>
            {renderInlineText(block.text, paragraphStyle, styles.boldText, `paragraph-${index}`)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
  },
  blockSpacing: {
    marginBottom: 10,
  },
  bubbleText: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  panelText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  bubbleHeading: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter_700Bold",
  },
  panelHeading: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Inter_700Bold",
  },
  bubbleSubheading: {
    color: Colors.primaryLight,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_600SemiBold",
  },
  panelSubheading: {
    color: Colors.primaryLight,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Inter_600SemiBold",
  },
  boldText: {
    fontFamily: "Inter_700Bold",
  },
  italicText: {
    fontStyle: "italic",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  listMarker: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 1,
  },
  numberMarker: {
    fontSize: 13,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
    minWidth: 22,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: 2,
  },
  bubbleTableCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  panelTableCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  visualCard: {
    gap: 10,
  },
  visualHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  visualTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Inter_700Bold",
  },
  visualPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  visualPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  metricStrip: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.background + "55",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  metricValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  metricLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  chartLabelBubble: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  chartLabelPanel: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  tableTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  tableCardTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
  },
  rowValuePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rowValuePillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  tableField: {
    marginTop: 4,
    gap: 4,
  },
  tableFieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  tableFieldLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flex: 1,
  },
  tableFieldValue: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
    flexShrink: 1,
  },
  inlineBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceBorder,
    overflow: "hidden",
  },
  inlineBarFill: {
    height: "100%",
    borderRadius: 999,
  },
});
