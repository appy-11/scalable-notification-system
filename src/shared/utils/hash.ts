import { createHash } from "node:crypto";

export function hashObject(value: unknown): string {
  const serialized = JSON.stringify(value);

  return createHash("sha256").update(serialized).digest("hex");
}
