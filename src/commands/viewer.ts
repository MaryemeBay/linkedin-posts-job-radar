import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import open from 'open';
import cors from 'cors';
import { createApiRouter } from '../viewer/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ViewerResult {
  port: number;
  status: 'started' | 'already_running';
  url: string;
  message: string;
}

// Module-level state tracking for singleton pattern
let activeViewer: {
  server: http.Server;
  port: number;
  url: string;
} | null = null;

/** Default dashboard port. Override with JOB_RADAR_PORT. */
const DEFAULT_PORT = 7391;

/**
 * The port to serve the dashboard on. Reads JOB_RADAR_PORT so the port can
 * be changed without editing code - useful when something else already holds it.
 */
function resolvePort(): number {
  const configured = process.env.JOB_RADAR_PORT;
  if (!configured) return DEFAULT_PORT;

  const parsed = Number(configured);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      `JOB_RADAR_PORT must be an integer between 1 and 65535, got "${configured}"`
    );
  }
  return parsed;
}

/**
 * Start the viewer: an Express server for the pre-built React bundle
 * Serves pre-built static files from dist/ with API routes
 * Reuses existing server if already running
 */
export async function startViewer(): Promise<ViewerResult> {
  // Check if server is already running
  if (activeViewer) {
    // Open browser again for convenience
    await open(activeViewer.url);
    
    return {
      port: activeViewer.port,
      status: 'already_running',
      url: activeViewer.url,
      message: `Viewer already running at ${activeViewer.url}. Browser opened again.`
    };
  }
  
  const PORT = resolvePort();
  
  // Compiled layout is build/commands/viewer.js, with the built viewer bundle
  // copied alongside it at build/viewer/web (see the copy-viewer npm script).
  const buildRoot = path.resolve(__dirname, '..');
  const distDir = path.join(buildRoot, 'viewer', 'web');
  
  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    throw new Error(`Dist directory not found: ${distDir}. Did you run 'npm run build'?`);
  }
  
  // Create Express app
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // API routes
  app.use('/api', createApiRouter());
  
  // Serve static files from dist directory
  app.use(express.static(distDir));
  
  // SPA fallback - serve index.html for all other routes
  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  
  // Create HTTP server
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    
    // Handle server errors
    server.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${PORT} is already in use. Set JOB_RADAR_PORT to a free port and try again.`
        ));
        return;
      }
      reject(new Error(`Failed to start viewer: ${error.message}`));
    });
    
    // Start listening
    server.listen(PORT, () => {
      const url = `http://localhost:${PORT}`;
      
      // Store active server info for singleton pattern
      activeViewer = {
        server,
        port: PORT,
        url
      };
      
      // Open browser
      open(url).catch(() => {
        // Ignore browser open errors
      });
      
      resolve({
        port: PORT,
        status: 'started',
        url: url,
        message: `Viewer started at ${url}. Browser opened automatically.\n\nReact app auto-polls for updates every 3 seconds - no page reloads needed!`
      });
    });
  });
}

/**
 * Stop the viewer server
 * Shuts down the active server and clears the singleton state
 */
export function stopViewer(): { success: boolean; message: string } {
  if (!activeViewer) {
    return {
      success: false,
      message: 'The viewer is not running.'
    };
  }
  
  try {
    const url = activeViewer.url;
    activeViewer.server.close();
    activeViewer = null;
    
    return {
      success: true,
      message: `Viewer at ${url} has been stopped.`
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to stop viewer: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
