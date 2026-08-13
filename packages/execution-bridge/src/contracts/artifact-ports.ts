// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Artifact Reader Port
// SPRINT-024 — REAL RUNTIME ARTIFACT VERIFICATION (Phase 1)
//
// The ONLY seam through which artifact verification reads real files.
// The reader is confined to an APPROVED EXECUTION BOUNDARY ROOT:
//   - paths are RELATIVE to the root (absolute paths denied),
//   - `..` traversal is denied,
//   - reads are SIZE-BOUNDED (a cap set by the implementation),
//   - it NEVER executes commands, never mutates state.
//
// The port is injectable so the verifier stays hermetic-testable;
// the production implementation is `NodeArtifactReader`.
// ──────────────────────────────────────────────────────────────────

export interface ArtifactReadResult {
  /** True when the file exists inside the boundary. */
  found: boolean;
  /** True when the request was denied (traversal / absolute / over-size). */
  denied?: boolean;
  /** File content when found and within bounds. */
  content?: string;
  /** Approximate byte length of the artifact (bounded). */
  byteLength?: number;
  /** Aggregate-only reason (never a secret). */
  error?: string;
}

export interface ArtifactExistence {
  /** True when the file exists inside the boundary. */
  found: boolean;
  /** True when the existence probe was denied (unsafe path). */
  denied?: boolean;
}

export interface ArtifactReaderPort {
  /** The approved execution boundary root the reader is confined to. */
  readonly root: string;
  /** Maximum bytes the reader will ever hand back. */
  readonly maxBytes: number;
  /** Read a file by RELATIVE path within the boundary root. */
  read(relativePath: string): Promise<ArtifactReadResult>;
  /** Probe existence at the RELATIVE path within the boundary root. */
  exists(relativePath: string): Promise<ArtifactExistence>;
}
