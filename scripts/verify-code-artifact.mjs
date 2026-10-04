#!/usr/bin/env node
// Independent verifier for the VedMoulya REAL-08 multi-line code artifact.
//
// A REAL Node process. No VedMoulya runtime, no mission machinery, no AI,
// no model, no provider, no shell execution. It only reads and imports the
// one artifact path given on the command line.
//
// Usage:
//   node scripts/verify-code-artifact.mjs <workspaceRoot> <artifactRelPath>
//
// Exit codes:
//   0 = artifact independently verified
//   1 = artifact exists but verification failed
//   2 = invalid invocation / verifier error
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIN_CHARS = 200;
const MIN_LINES = 15;

// The exact artifact contract required by the REAL-08 acceptance test.
const REQUIRED_SOURCE_TEXTS = [
  'export const THRESHOLD',
  'export function score(checks)',
  'export function verdict(ratio)',
  'VEDMOULYA_REAL08_MARKER',
];

const rootArg = process.argv[2];
const artifactRelArg = process.argv[3];
if (!rootArg || !artifactRelArg) {
  console.error('usage: verify-code-artifact.mjs <workspaceRoot> <artifactRelPath>');
  process.exit(2);
}

const root = resolve(rootArg);
const artifact = resolve(root, artifactRelArg);

// The verifier never reads outside the workspace root it was handed.
const rel = relative(root, artifact);
if (rel === '' || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
  console.error('REFUSING: artifact path escapes the supplied workspace root: ' + artifactRelArg);
  process.exit(2);
}

if (!existsSync(artifact)) {
  console.error('MISSING artifact: ' + artifact);
  process.exit(1);
}

const failures = [];

let source = '';
try {
  source = readFileSync(artifact, 'utf8');
} catch (error) {
  console.error('UNREADABLE artifact: ' + error.message);
  process.exit(2);
}

const lineCount = source.split('\n').length;

if (source.length <= MIN_CHARS) {
  failures.push(
    'artifact is ' + source.length + ' chars, not beyond the ' + MIN_CHARS + ' char cap',
  );
}
if (lineCount <= MIN_LINES) {
  failures.push('artifact has ' + lineCount + ' lines, not more than ' + MIN_LINES);
}

for (const needle of REQUIRED_SOURCE_TEXTS) {
  if (!source.includes(needle)) {
    failures.push('missing required source text: ' + JSON.stringify(needle));
  }
}

let mod = null;
try {
  mod = await import(pathToFileURL(artifact).href);
} catch (error) {
  failures.push('artifact is not importable as an ES module: ' + error.message);
}

if (mod !== null) {
  if (typeof mod.THRESHOLD !== 'number') {
    failures.push('THRESHOLD is not an exported number');
  } else if (mod.THRESHOLD !== 0.82) {
    failures.push('THRESHOLD must be 0.82, got ' + mod.THRESHOLD);
  }

  if (typeof mod.score !== 'function') {
    failures.push('score is not an exported function');
  } else {
    try {
      const allPass = mod.score([true, true, true]);
      if (allPass !== 1) failures.push('score([true,true,true]) must be 1, got ' + allPass);
      const half = mod.score([true, false]);
      if (half !== 0.5) failures.push('score([true,false]) must be 0.5, got ' + half);
      const threeOfFour = mod.score([true, true, true, false]);
      if (threeOfFour !== 0.75)
        failures.push('score([true,true,true,false]) must be 0.75, got ' + threeOfFour);
      const none = mod.score([]);
      if (none !== 0) failures.push('score([]) must be 0, got ' + none);
    } catch (error) {
      failures.push('score threw: ' + error.message);
    }
  }

  if (typeof mod.verdict !== 'function') {
    failures.push('verdict is not an exported function');
  } else {
    try {
      if (typeof mod.score === 'function') {
        const ready = mod.verdict(mod.score([true, true, true]));
        if (ready !== 'READY')
          failures.push("verdict(score(all-pass)) must be 'READY', got " + ready);
        const atRisk = mod.verdict(mod.score([true, false]));
        if (atRisk !== 'AT_RISK')
          failures.push("verdict(score([true,false])) must be 'AT_RISK', got " + atRisk);
        const blocked = mod.verdict(mod.score([]));
        if (blocked !== 'BLOCKED')
          failures.push("verdict(score([])) must be 'BLOCKED', got " + blocked);
      }
      const readyDirect = mod.verdict(1);
      if (readyDirect !== 'READY') failures.push('verdict(1) must be READY, got ' + readyDirect);
      const blockedDirect = mod.verdict(0);
      if (blockedDirect !== 'BLOCKED')
        failures.push('verdict(0) must be BLOCKED, got ' + blockedDirect);
    } catch (error) {
      failures.push('verdict threw: ' + error.message);
    }
  }

  if (mod.default === undefined || mod.default === null) {
    failures.push('artifact has no default export');
  }
}

if (failures.length > 0) {
  console.error('CODE ARTIFACT VERIFICATION FAILED (' + failures.length + ' problem(s)):');
  for (const failure of failures) {
    console.error('  - ' + failure);
  }
  process.exit(1);
}

console.log(
  'CODE ARTIFACT VERIFIED: ' +
    artifactRelArg +
    ' (' +
    source.length +
    ' chars, ' +
    lineCount +
    ' lines) multi-line, structural and behavioural checks all pass',
);
