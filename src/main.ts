#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handleSession } from './commands/session.js';
import { handleHarvest } from './commands/harvest.js';
import { handleVacancies } from './commands/posts.js';
import { handleDashboardFilters } from './commands/view-filters.js';
import { startViewer, stopViewer } from './commands/viewer.js';
import { createRequire } from 'node:module';
import { closeDatabase } from './store/connection.js';

// Report the installed version rather than a hardcoded one, which had drifted
// from package.json.
const { version } = createRequire(import.meta.url)('../package.json');

// Initialize MCP server
const server = new Server(
  {
    name: "linkedin-posts-job-radar",
    version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "linkedin_session",
        description: "Manage LinkedIn authentication: authenticate, check status, or clear credentials",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["authenticate", "status", "clear"],
              description: "Action to perform: 'authenticate' to log in, 'status' to check credentials, 'clear' to remove credentials"
            },
            force_reauth: {
              type: "boolean",
              description: "Force new authentication even if valid credentials exist (only used with 'authenticate' action)",
              default: false
            }
          },
          required: ["action"]
        },
      },
      {
        name: "harvest_posts",
        description: "Search LinkedIn posts with keywords and optional pagination",
        inputSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "string",
              description: "Search keywords or query (e.g., 'machine learning', '\"AI engineer\"')"
            },
            pagination: {
              type: "number",
              description: "Number of scroll pages to load more results)",
              default: 2,
              minimum: 1,
              maximum: 10
            },
            headless: {
              type: "boolean",
              description: "Run browser in headless mode (default: false). Headless mode is faster and uses less resources. ",
              default: false
            }
          },
          required: ["keywords"]
        },
      },
      {
        name: "vacancies",
        description: "Read, count or delete harvested vacancies. Filter by keyword, country, pay, triage verdict or application status. Read in small batches to keep context small.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["read", "delete", "count"],
              description: "read: get posts with full descriptions | delete: remove posts | count: get totals with filters"
            },
            keyword: {
              type: "string",
              description: "Filter by LinkedIn search keyword column (e.g., 'python engineer', 'backend developer')"
            },
            contains: {
              type: "string",
              description: "Search for text within post descriptions (e.g., 'remote', '$150k', 'healthcare benefits')"
            },
            ids: {
              type: "array",
              items: { type: "number" },
              description: "Specific post IDs to read or delete"
            },
            limit: {
              type: "number",
              description: "How many posts to return (default: 5, max: 20). Use small batches to manage context.",
              default: 5,
              minimum: 1,
              maximum: 20
            },
            offset: {
              type: "number",
              description: "Skip first N posts for pagination (default: 0). Use with limit to process posts in batches.",
              default: 0,
              minimum: 0
            },
            applied: {
              type: "boolean",
              description: "Filter by applied status: true for applied, false for not applied"
            },
            verdict: {
              type: "string",
              enum: ["", "yes", "maybe", "no"],
              description: "Filter by triage rating: 'yes' interested, 'maybe' undecided, 'no' not interested, '' not yet rated"
            },
            country: {
              type: "string",
              description: "Filter by inferred country (e.g., 'France', 'United Kingdom', 'Remote (Europe)'). Matches posts whose country list contains this value."
            },
            has_salary: {
              type: "boolean",
              description: "Filter by whether the post quotes pay: true for posts with a detected salary, false for posts without"
            }
          },
          required: ["action"]
        },
      },
      {
        name: "open_dashboard",
        description: "Open the local dashboard in a browser to browse and triage harvested vacancies",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
      },
      {
        name: "close_dashboard",
        description: "Shut down the dashboard server",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
      },
      {
        name: "dashboard_filters",
        description: "Read or change the dashboard's filters. The dashboard and this tool share one filter state, so changes here are reflected in the browser within a couple of seconds.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["read", "update"],
              description: "Action to perform: 'read' to get current filter state, 'update' to change filters"
            },
            keyword: {
              type: "string",
              description: "Show only posts from this search keyword; empty string shows all keywords"
            },
            applied: {
              type: "string",
              enum: ["all", "applied", "not-applied"],
              description: "Show all posts, only applied ones, or only ones not applied to yet"
            },
            verdict: {
              type: "string",
              enum: ["all", "yes", "maybe", "no", "unrated"],
              description: "Show all posts, or only those you rated interested / maybe / not interested / not yet rated"
            },
            pay: {
              type: "string",
              enum: ["all", "with-pay"],
              description: "Show all posts, or only those quoting pay"
            },
            country: {
              type: "string",
              description: "Show only posts for this market (e.g. 'France', 'United Kingdom', 'Remote (Europe)'); empty string shows all"
            },
            reset: {
              type: "boolean",
              description: "Clear every filter"
            }
          },
          required: ["action"]
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: params } = request.params;

  try {
    switch (name) {
      case "linkedin_session":
        return await handleSession(params as any);
        
      case "harvest_posts":
        return await handleHarvest(params as any);
        
      case "vacancies":
        return await handleVacancies(params as any);
        
      case "open_dashboard":
        const viewerResult = await startViewer();
        return {
          content: [{
            type: "text",
            text: `Viewer started.\n\n${viewerResult.message}\n\nIf the browser did not open, visit: ${viewerResult.url}`
          }]
        };
        
      case "close_dashboard":
        const stopResult = stopViewer();
        return {
          content: [{
            type: "text",
            text: stopResult.message
          }]
        };
        
      case "dashboard_filters":
        return await handleDashboardFilters(params as any);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

// MCP servers communicate via JSON-RPC over stdin/stdout
// Do not write anything to stdout or it will corrupt the protocol

// Graceful shutdown handlers
// Ensures proper cleanup of resources when the MCP server stops
const cleanup = async () => {
  try {
    // Close database connection and save any pending changes
    closeDatabase();
    
    // Stop the viewer server if it is running
    stopViewer();
  } catch (error) {
    // Silently handle cleanup errors to avoid protocol corruption
  }
  
  process.exit(0);
};

// Handle termination signals
process.on('SIGTERM', cleanup);  // Docker/systemd termination
process.on('SIGINT', cleanup);   // Ctrl+C in terminal

// Handle normal process exit
process.on('exit', () => {
  // Final cleanup - must be synchronous
  try {
    closeDatabase();
  } catch (error) {
    // Ignore errors during final cleanup
  }
});

// Global error handlers to prevent crashes
// These catch unhandled errors that could otherwise crash the MCP server
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  // Log to stderr (not stdout, to avoid corrupting MCP protocol)
  // Don't crash the server - just handle the error gracefully
  try {
    closeDatabase(); // Ensure DB is saved
  } catch (error) {
    // Ignore cleanup errors
  }
});

process.on('uncaughtException', (error: Error) => {
  // Critical error - attempt cleanup and exit gracefully
  try {
    closeDatabase();
    stopViewer();
  } catch (cleanupError) {
    // Ignore cleanup errors
  }
  
  // Exit with error code
  process.exit(1);
});
