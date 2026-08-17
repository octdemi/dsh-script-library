/* Typert remote-client contribution for the scriptLibrary namespace —
 * hand-written in the shape the generator emits (reference:
 * @deepseek-ai/dsh-host-plugin-inventory lib/typert.remote-client.js).
 * This file is the reference shape; the client bundle inlines a copy (the
 * lazy-CJS browser bundle cannot import ESM). Plain ESM JS. */
import { z } from "zod";

const stagedEntrySchema = z
  .object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    summary: z.string(),
    source: z.string(),
    location: z.string(),
    createdAt: z.string(),
  })
  .readonly();

const listResultSchema = z
  .object({
    entries: z.array(stagedEntrySchema),
    count: z.number(),
  })
  .readonly();

const countResultSchema = z.object({ count: z.number() }).readonly();

const mutationResultSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().optional(),
    count: z.number(),
  })
  .readonly();

const stringCodec = { mode: "strict", schema: z.string() };

export const TYPERT_REMOTE = {
  package: "dsh-script-library",
  descriptors: [
    {
      id: "dsh-script-library#scriptLibrary/listStaged",
      service: "scriptLibrary",
      namespace: "scriptLibrary",
      method: "listStaged",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-script-library/types#StagedList",
        schema: listResultSchema,
      },
      sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
    },
    {
      id: "dsh-script-library#scriptLibrary/countStaged",
      service: "scriptLibrary",
      namespace: "scriptLibrary",
      method: "countStaged",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-script-library/types#StagedCount",
        schema: countResultSchema,
      },
      sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
    },
    {
      id: "dsh-script-library#scriptLibrary/approveEntry",
      service: "scriptLibrary",
      namespace: "scriptLibrary",
      method: "approveEntry",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          wire: "id",
          type: "string",
          source: "json",
          codec: stringCodec,
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-script-library/types#MutationResult",
        schema: mutationResultSchema,
      },
      sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
    },
    {
      id: "dsh-script-library#scriptLibrary/deleteEntry",
      service: "scriptLibrary",
      namespace: "scriptLibrary",
      method: "deleteEntry",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          wire: "id",
          type: "string",
          source: "json",
          codec: stringCodec,
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-script-library/types#MutationResult",
        schema: mutationResultSchema,
      },
      sourceLocation: { file: "packages/host/script-library/src/index.ts", line: 1, column: 1 },
    },
  ],
};

export default TYPERT_REMOTE;