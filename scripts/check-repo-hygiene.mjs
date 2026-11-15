#!/usr/bin/env node
// Repository hygiene gate.
//
// 1. Every tracked *.json file must parse as JSON (tsconfig files are allowed
//    to contain comments and trailing commas, as TypeScript accepts them).
// 2. No tracked file may be a secret, private key, model weight or live in a
//    private-data directory.
//
// The file list comes from `git ls-files`, so only files that are (or are
// about to be) committed are checked. Exit code is non-zero on any finding.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directories that hold private runtime data; mirrors .gitignore. */
export const PRIVATE_DIRECTORIES = [
  '.local-private',
  'private-data',
  'user-memories',
  'room-maps',
  'spatial-scans',
  'camera-captures',
  'voice-recordings',
  'generated-private-assets',
  'model-weights',
  'graphify-out',
];

/**
 * Multi-segment directories with private local agent state. Matched as a
 * contiguous run of path segments anywhere in the path.
 */
export const PRIVATE_NESTED_DIRECTORIES = ['.claude/agent-memory', '.claude/worktrees'];

/** SSH private key file names (public `.pub` counterparts are allowed). */
const SSH_PRIVATE_KEY_NAME = /^id_(rsa|dsa|ecdsa|ed25519)(_sk)?$/;

export const FORBIDDEN_EXTENSIONS = [
  '.pem',
  '.key',
  '.p12',
  '.p8',
  '.pfx',
  '.jks',
  '.keystore',
  '.mobileprovision',
  '.onnx',
  '.safetensors',
  '.ckpt',
  '.pt',
  '.pth',
  '.gguf',
];

/**
 * Returns a reason string when the path must not be committed, otherwise null.
 * @param {string} path repository-relative path using forward slashes
 * @returns {string | null}
 */
export function forbiddenReason(path) {
  const name = basename(path);
  const lower = name.toLowerCase();
  if ((lower === '.env' || lower.startsWith('.env.')) && lower !== '.env.example') {
    return 'environment file (only .env.example may be committed)';
  }
  const extension = FORBIDDEN_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (extension !== undefined) {
    return `forbidden file type ${extension} (keys, certificates or model weights)`;
  }
  if (SSH_PRIVATE_KEY_NAME.test(lower)) {
    return 'SSH private key';
  }
  // Directory names are compared case-insensitively so that, for example,
  // `Room-Maps/` cannot bypass the check on case-insensitive file systems.
  const directories = path.toLowerCase().split('/').slice(0, -1);
  const privateDir = directories.find((segment) => PRIVATE_DIRECTORIES.includes(segment));
  if (privateDir !== undefined) {
    return `inside private-data directory ${privateDir}/`;
  }
  const directoryPath = `/${directories.join('/')}/`;
  const nested = PRIVATE_NESTED_DIRECTORIES.find((dir) => directoryPath.includes(`/${dir}/`));
  if (nested !== undefined) {
    return `inside private agent-state directory ${nested}/`;
  }
  return null;
}

/**
 * Removes comments and trailing commas so tsconfig-style JSONC can be parsed.
 * String contents are preserved.
 * @param {string} text
 * @returns {string}
 */
export function stripJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** @returns {string[]} */
function trackedFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return output.split('\0').filter((path) => path.length > 0);
}

function main() {
  const files = trackedFiles();
  /** @type {string[]} */
  const problems = [];

  for (const path of files) {
    const reason = forbiddenReason(path);
    if (reason !== null) problems.push(`${path}: ${reason}`);
  }

  const jsonFiles = files.filter((path) => path.toLowerCase().endsWith('.json'));
  for (const path of jsonFiles) {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      // Deleted in the working tree but still in the index; nothing to parse.
      continue;
    }
    const isJsonc = /(^|\/)tsconfig(\.[^/]*)?\.json$/.test(path);
    try {
      JSON.parse(isJsonc ? stripJsonc(text) : text);
    } catch (error) {
      problems.push(
        `${path}: invalid JSON (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  if (problems.length > 0) {
    console.error(`Repository hygiene check failed with ${String(problems.length)} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Repository hygiene check passed: ${String(files.length)} files scanned, ${String(jsonFiles.length)} JSON files valid.`,
  );
}

const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) {
  main();
}
