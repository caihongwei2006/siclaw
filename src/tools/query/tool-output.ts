import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ToolEntry } from "../../core/tool-registry.js";
import type { ToolOutputStore } from "../infra/tool-output-store.js";
import { renderTextResult } from "../infra/tool-render.js";

export function createToolOutputTool(store?: ToolOutputStore): ToolDefinition {
  return {
    name: "tool_output",
    label: "Tool Output",
    description: "Read selected lines of saved command output by output_id, without rerunning the command. " +
      "Long command results show evenly spaced samples with omitted gaps; use this tool to inspect those gaps. " +
      "Returns total_lines and up to 8000 source characters. offset and column are 1-based; limit defaults to 100 lines. " +
      "For more output, pass the returned next.offset and next.column (a long line can span several reads). " +
      "Saved output remains available until the task is explicitly closed.",
    parameters: Type.Object({
      output_id: Type.String({ description: "The output_id in a command result's siclaw-output reference." }),
      offset: Type.Optional(Type.Integer({ minimum: 1, description: "First line to read (1-based)." })),
      limit: Type.Optional(Type.Integer({ minimum: 1, description: "Maximum lines to read (default 100), within the 8000-character budget." })),
      column: Type.Optional(Type.Integer({ minimum: 1, description: "Starting UTF-16 column in the first line (1-based); use next.column to continue a long line." })),
    }),
    renderResult: renderTextResult,
    async execute(_id, rawParams) {
      try {
        const params = rawParams as { output_id: string; offset?: number; limit?: number; column?: number };
        if (!store) throw new Error("tool_output is unavailable in this session.");
        const page = store.read(params.output_id, params.offset, params.limit, params.column);
        const reference = `[siclaw-output ${page.total_chars} chars; ${page.total_lines} lines total; read selected lines with tool_output(${JSON.stringify({ output_id: page.output_id, offset: params.offset ?? 1, limit: params.limit ?? 100, column: params.column ?? 1 })})]`;
        const { output, ...metadata } = page;
        return {
          content: [{ type: "text", text: `${reference}\n${JSON.stringify(metadata)}\n${output}` }],
          details: metadata,
        };
      } catch (error) {
        return { content: [{ type: "text", text: (error as Error).message }], details: { error: true } };
      }
    },
  };
}

export const registration: ToolEntry = {
  category: "query",
  create: (refs) => createToolOutputTool(refs.toolOutputStore),
  available: (refs) => Boolean(refs.toolOutputStore),
  readOnlyDelegable: true,
};
