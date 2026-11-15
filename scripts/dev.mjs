#!/usr/bin/env node
// Runs the `dev` script of every workspace that defines one, concurrently,
// with output prefixed by workspace name. Ctrl+C stops all of them. If any
// process exits with an error, the others are stopped and the exit code is
// propagated. No third-party dependency is needed.

import { execSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
// npm is a .cmd shim on Windows, which can only be launched through a shell.
// Commands are passed as one string (no separate args) and workspace names
// are validated, so nothing untrusted is interpolated into the shell line.
const WORKSPACE_NAME = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;

/** @returns {string[]} names of workspaces that define a `dev` script */
function workspacesWithDevScript() {
  const output = execSync('npm query .workspace --json', { cwd: ROOT, encoding: 'utf8' });
  /** @type {{ name: string, path: string }[]} */
  const workspaces = JSON.parse(output);
  return workspaces
    .filter((ws) => {
      /** @type {{ scripts?: Record<string, string> }} */
      const manifest = JSON.parse(readFileSync(join(ws.path, 'package.json'), 'utf8'));
      return typeof manifest.scripts?.['dev'] === 'string';
    })
    .map((ws) => {
      if (!WORKSPACE_NAME.test(ws.name)) throw new Error(`Unexpected workspace name: ${ws.name}`);
      return ws.name;
    });
}

/**
 * @param {string} name
 * @param {NodeJS.ReadableStream} stream
 * @param {NodeJS.WritableStream} target
 */
function prefixLines(name, stream, target) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (/** @type {string} */ chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => {
    if (buffer.length > 0) target.write(`[${name}] ${buffer}\n`);
  });
}

function main() {
  const names = workspacesWithDevScript();
  if (names.length === 0) {
    console.log('No workspace defines a "dev" script yet; nothing to run.');
    return;
  }
  console.log(`Starting dev scripts for: ${names.join(', ')}`);

  /** @type {import('node:child_process').ChildProcess[]} */
  const children = [];
  let stopping = false;

  const stopAll = () => {
    stopping = true;
    for (const child of children) {
      if (child.exitCode === null) child.kill();
    }
  };

  for (const name of names) {
    const child = spawn(`npm run dev --workspace ${name}`, {
      cwd: ROOT,
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    if (child.stdout) prefixLines(name, child.stdout, process.stdout);
    if (child.stderr) prefixLines(name, child.stderr, process.stderr);
    child.on('exit', (code, signal) => {
      if (!stopping) {
        console.error(`[${name}] exited (${signal ?? String(code)}); stopping the others.`);
        if (code !== 0) process.exitCode = code ?? 1;
        stopAll();
      }
    });
    children.push(child);
  }

  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);
}

main();
