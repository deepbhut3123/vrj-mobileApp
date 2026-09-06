const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const lockPath = path.join(__dirname, '.android-release.lock');
const easCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

try {
  fs.mkdirSync(lockPath);
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('An Android release is already running. Wait for it to finish before starting another one.');
    process.exit(1);
  }
  throw error;
}

const cleanup = () => {
  try {
    fs.rmdirSync(lockPath);
  } catch {
    // The lock is best-effort cleanup; the process exit code remains authoritative.
  }
};

process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const child = spawn(
  easCommand,
  [
    'eas-cli',
    'build',
    '--platform',
    'android',
    '--profile',
    'production',
    '--auto-submit',
    '--wait',
    '--non-interactive',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);

child.on('error', (error) => {
  console.error(`Unable to start EAS: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`EAS release stopped by ${signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
