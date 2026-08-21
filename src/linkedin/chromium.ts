import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type LaunchOptions } from 'playwright';

const execFileAsync = promisify(execFile);

/**
 * Playwright's own message when the browser binary is absent.
 */
const BROWSER_MISSING = /Executable doesn't exist|Please run the following command to download/i;

/** Only ever attempt the download once per process. */
let downloadAttempted = false;

/**
 * Path to Playwright's CLI, used to fetch the browser.
 *
 * Resolved from the installed package rather than assumed, since the layout
 * differs between a plain npm install and a bundled distribution.
 */
function playwrightCli(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    return fs.existsSync(cli) ? cli : null;
  } catch {
    return null;
  }
}

/**
 * Download Chromium. Slow (roughly 130 MB) but only needed once per machine.
 */
async function downloadChromium(): Promise<void> {
  const cli = playwrightCli();
  if (!cli) {
    throw new Error('Could not locate the Playwright CLI to download Chromium.');
  }
  await execFileAsync(process.execPath, [cli, 'install', 'chromium'], {
    timeout: 10 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

/**
 * Launch Chromium, fetching it first if it is not installed.
 *
 * A plain `npm install` downloads the browser through Playwright's postinstall
 * hook, but distributions that ship dependencies pre-installed - an MCPB bundle,
 * for instance - never run that hook, so the first launch would otherwise fail
 * with Playwright's raw "Executable doesn't exist" error.
 */
export async function launchChromium(options: LaunchOptions = {}): Promise<Browser> {
  try {
    return await chromium.launch(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!BROWSER_MISSING.test(message) || downloadAttempted) {
      throw error;
    }

    downloadAttempted = true;

    try {
      await downloadChromium();
    } catch (downloadError) {
      const detail = downloadError instanceof Error ? downloadError.message : String(downloadError);
      throw new Error(
        'Chromium is not installed and could not be downloaded automatically. ' +
        'Run "npx playwright install chromium" and try again.\n\n' +
        `Download failed: ${detail}`
      );
    }

    return chromium.launch(options);
  }
}
