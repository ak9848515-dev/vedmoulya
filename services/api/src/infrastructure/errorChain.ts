// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Error cause-chain diagnostics
//
// Drizzle wraps query failures in a generic `Error: Failed query: <sql>` and
// keeps the REAL driver failure in `.cause` (e.g. `ECONNREFUSED` when the
// database host/port is wrong, `42501` permission denied, `42P01`
// undefined_table). Logging only `error.message` therefore hides the actual
// root cause — which is exactly why a DDL bootstrap failure was reported as an
// unexplained blocker in QUALITY-SPRINT-004 D-08b.
//
// `describeErrorChain` keeps BOTH the wrapper message and the underlying driver
// code/severity so operators can distinguish a configuration/connection fault
// from a schema or permission fault. It never includes a DSN: it only reads
// `name`, `message`, `code` and `severity` from each link.
// ─────────────────────────────────────────────────────────────────────────────

/** Render a scalar without ever invoking Object's default `[object Object]`. */
function renderScalar(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    case 'symbol':
      return value.toString();
    case 'undefined':
      return 'undefined';
    default:
      // Objects/functions: a safe, non-invoking tag.
      return Object.prototype.toString.call(value);
  }
}

/**
 * Flatten an error and its `cause` chain into a single diagnostic string.
 * Cycles are detected and stop the walk; the chain is truncated at `maxDepth`.
 */
export function describeErrorChain(error: unknown, maxDepth = 8): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth < maxDepth && current !== undefined && current !== null; depth += 1) {
    if (seen.has(current)) {
      parts.push('[circular cause]');
      break;
    }
    seen.add(current);

    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      const severity = (current as { severity?: unknown }).severity;
      const firstLine =
        current.message
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.length > 0) ?? '';
      const meta = [
        code !== undefined && code !== null ? `code=${renderScalar(code)}` : null,
        severity !== undefined && severity !== null ? `severity=${renderScalar(severity)}` : null,
      ]
        .filter((entry): entry is string => entry !== null)
        .join(' ');
      parts.push(`${current.name}${meta.length > 0 ? `(${meta})` : ''}: ${firstLine}`);
      current = (current as { cause?: unknown }).cause;
    } else {
      parts.push(renderScalar(current));
      current = undefined;
    }
  }

  return parts.length > 0 ? parts.join(' <- ') : renderScalar(error);
}
