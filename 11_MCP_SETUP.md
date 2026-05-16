# MCP Setup for Antigravity

## Purpose
MCP servers can give the agent controlled access to tools such as GitHub, browser automation, file systems, databases, and documentation. Use them carefully. More MCPs do not automatically mean a better project; use only what helps this CEP.

## Recommended MCPs for this project

### 1. Filesystem MCP
Use for controlled reading/writing inside the project folder.

Why useful:
- lets agent inspect project files;
- helps with refactoring and docs updates.

Safety rule:
- restrict access to the project workspace only;
- do not grant access to your whole user folder.

### 2. GitHub MCP
Use if your project is on GitHub.

Why useful:
- create commits/branches;
- inspect issues/PRs;
- keep implementation organized.

Safety rule:
- do not paste GitHub tokens in chat;
- use official OAuth/token setup in the MCP client.

### 3. Playwright MCP / Browser automation
Use for UI testing and screenshots.

Why useful:
- tests dashboard routes;
- verifies duplicate penalty UI;
- captures real screenshots for report.

Safety rule:
- allow only localhost URLs during development.

### 4. Database MCP / PostgreSQL MCP
Use only if you switch from SQLite to PostgreSQL or Supabase.

Why useful:
- inspect schema;
- run read-only verification queries.

Safety rule:
- start with read-only permissions;
- never expose production credentials.

### 5. Docker MCP
Use only if containerizing the project.

Why useful:
- inspect containers;
- run compose services.

Safety rule:
- review destructive commands.

## Antigravity setup guidance
Use Review-driven mode at first. Keep terminal commands under review until the project is stable. Allow safe commands like listing files, installing dependencies, running tests, and starting local dev servers. Keep destructive commands like `rm -rf`, deleting database files, or force-pushing under review.

## Example MCP configuration idea
Exact package names can change, so use this as a template, not blind copy-paste. Prefer installing from Antigravity MCP Store or the official MCP server documentation.

```json
{
  "mcpServers": {
    "filesystem-cep": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:/path/to/traffic-alert-cep"
      ]
    },
    "playwright-local": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

## Safe permissions checklist
- Browser allowlist: `localhost`, `127.0.0.1`, official documentation domains only.
- Terminal execution: request review initially.
- File access: workspace only.
- MCP access: enable only needed MCP servers.
- Secrets: keep `.env` out of prompts and screenshots.
- Git: commit small milestones after tests pass.

## MCPs that are not necessary for this CEP
- Slack/Discord MCP: not needed.
- Cloud deployment MCP: optional only after project works locally.
- Google Workspace MCP: not needed unless collaborating through Drive/Docs.
- Complex observability MCP: not required for marks.

## Best Antigravity workflow with MCP
1. Ask the agent to plan.
2. Review the plan.
3. Let it implement one module.
4. Let it run tests.
5. Inspect generated artifacts/screenshots.
6. Commit only after evidence is real.
