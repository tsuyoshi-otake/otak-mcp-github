# Roo Code & MCP — **Complete Knowledge Collection (2025-05 Edition)**
A comprehensive document that provides an overview of the AI-powered VS Code extension *Roo Code* and *Model Context Protocol (MCP)*, integrating implementation tutorials, configuration examples, and utilization know-how into a single Markdown file.

---

## Table of Contents
0. How to Read This Document
1. Introduction
2. Installation & Prerequisites
3. Roo Code Core Features
4. MCP — Extensions and Integration
5. Four Techniques to Master Roo Code
6. Hands-on: Implementation Tutorials
   6-1. Single PR Review Workflow
   6-2. Multiple PR Integration Review Workflow
   6-3. Autonomous Agent (Extracting "Yes")
7. Roo Code Panel Operation & MCP Core Activation
8. Practical Use Cases
9. Pro Tips (Maximizing Efficiency)
10. Summary / Future Outlook
11. Appendix A: Key File Templates
12. Appendix B: Terminology Quick Reference

---

## 0. How to Read This Document
* **Beginners** ... Start with Chapter 2 (Installation) → Chapter 4 (MCP) → Chapter 6 (Tutorials).
* **Existing Users** ... Quickly review Chapter 5 (Techniques) and Chapters 8-9 (Tips).
* **Custom Integration Developers** ... Refer to Chapter 4 (MCP Configuration) and Chapter 11 (Templates).

---

## 1. Introduction
- **Roo Code**
  Integrates an AI assistant into VS Code to automate code generation, refactoring, debugging, testing,
  documentation generation, and PR reviews with **no-code** required.
- **Model Context Protocol (MCP)**
  An extension protocol that evolves Roo Code into a "plugin platform".
  Enables bidirectional communication with external tools, allowing LLMs to freely utilize information and execute commands.

> 💡 Example: Connecting the Apidog MCP Server automates API definition → DTO creation / code generation / comment addition.

---

## 2. Installation & Prerequisites

### 2.1 Required Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **VS Code** | Main IDE | Latest version recommended |
| **Roo Code Extension** | AI & MCP functionality | Available in Marketplace |
| **LLM API Key** | OpenAI / Anthropic etc. | Configure in `.env` or Roo Code UI |
| **(Optional) MCP Server** | Apidog etc. | Register in JSON as described below |

### 2.2 Roo Code Extension Installation Steps
1. Launch VS Code → `Ctrl/Cmd + Shift + X`
2. Search for "roo code" → Select publisher *Roo Code Inc.* → **Install**
3. After reloading, the 🦘 icon appears in the Activity Bar → Click to launch control panel
4. Enter LLM key in `Settings → API Keys`

---

## 3. Roo Code Core Features

### 3.1 Intelligent Mode Switching
Change modes *automatically* or *manually* via `.roomodes` according to the development phase,
providing optimal prompts, permissions, and tool sets.

### 3.2 Smart Development Tools
| Feature | Overview | Typical Use |
|---------|----------|-------------|
| File I/O | Safe reading/writing of project files | Batch header updates, template insertion |
| Terminal Control | CLI execution in a sandbox | `npm test` or `mvn package` |
| Browser Automation | Control Chrome/Edge | e2e / UI testing |
| MCP Integration | External tool connection | Apidog, Custom Linter, DB, etc. |

---

## 4. MCP — Extensions and Integration

### 4.1 MCP Overview
```
Roo Code  ←→  MCP Bridge  ←→  Any Tool
               (JSON Config)    (CLI / gRPC / WebSocket …)
```
- Managed with **workspace-wide common** settings.
- Appears as *tool_use* to the LLM.

### 4.2 Configuration File `cline_mcp_settings.json`
```jsonc
{
  "servers": [
    {
      "name": "Apidog",
      "transport": "stdio",
      "command": "apidog-mcp",
      "arguments": ["--project", "pet-store"]
    },
    {
      "name": "MyCustomTool",
      "transport": "stdio",
      "command": "/path/to/tool",
      "arguments": ["--config", "conf.yml"]
    }
  ]
}
```

### 4.3 Capabilities of Apidog MCP Server
- API specification search / code generation / DTO and comment auto-insertion
- Combined with Memory Bank to **always reference the latest API definitions**

> npm: `npm i -g apidog-mcp-server`
> Docs: <https://apidog.com/docs/mcp>

### 4.4 MCP Configuration Details

#### 4.4.1 Configuration Levels
MCP server configurations can be managed at two levels:

- **Global Configuration**: Stored in the `mcp_settings.json` file, accessible via VS Code settings
- **Project Configuration**: Defined in a `.roo/mcp.json` file within your project's root directory
  - Allows project-specific settings
  - Can be shared with your team (by including it in version control)

Precedence: If a server name exists in both global and project configurations, the **project-level configuration takes precedence**.

#### 4.4.2 MCP Configuration File Structure

```jsonc
{
  "mcpServers": {
    "server1": {
      "type": "stdio",
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": {
        "API_KEY": "your_api_key"
      },
      "alwaysAllow": ["tool1", "tool2"],
      "disabled": false
    }
  }
}
```

### 4.5 MCP Server Transport Types

MCP supports two primary transport mechanisms:

#### 4.5.1 STDIO Transport
- Runs locally on your machine and communicates via standard input/output streams
- Characteristics:
  - Very low latency and overhead (no network stack involved)
  - Simplicity of direct process communication
  - Inherently secure with no network exposure
  - One-to-one relationship between client and server

**STDIO configuration parameters**:
- `command` (required): The executable to run (e.g., node, python, npx)
- `args` (optional): An array of string arguments to pass to the command
- `cwd` (optional): The working directory from which to launch the server process
- `env` (optional): An object containing environment variables for the server process
- `alwaysAllow` (optional): An array of tool names to automatically approve
- `disabled` (optional): Set to true to disable this server configuration

#### 4.5.2 SSE Transport
- Runs on a remote server and communicates over HTTP/HTTPS
- Characteristics:
  - Can handle multiple client connections concurrently
  - Works over standard HTTP (no special protocols needed)
  - Maintains a persistent connection for server-to-client messages
  - Can use standard HTTP authentication mechanisms

**SSE configuration parameters**:
- `url` (required): The full URL endpoint of the remote MCP server
- `headers` (optional): An object containing custom HTTP headers to send with requests
- `alwaysAllow` (optional): An array of tool names to automatically approve
- `disabled` (optional): Set to true to disable this server configuration

### 4.6 Platform-Specific MCP Configuration Examples

#### 4.6.1 Windows Configuration Example
```jsonc
{
  "mcpServers": {
    "puppeteer": {
      "type": "stdio",
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-puppeteer"
      ]
    }
  }
}
```

#### 4.6.2 macOS/Linux Configuration Example
```jsonc
{
  "mcpServers": {
    "puppeteer": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-puppeteer"
      ]
    }
  }
}
```

#### 4.6.3 Runtime Version Manager Configuration
```jsonc
{
  "mcpServers": {
    "appsignal": {
      "type": "stdio",
      "command": "/Users/myself/.asdf/installs/nodejs/22.2.0/bin/node",
      "args": [
        "/Users/myself/Code/Personal/my-mcp/build/index.js"
      ],
      "env": {
        "ASDF_NODE_VERSION": "22.2.0"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

---

## 5. Four Techniques to Master Roo Code

| # | Technique | Key Points |
|---|-----------|------------|
| 1 | **Output Format Control** | Eliminate Fluff (unnecessary chatter) and explicitly show CoT when needed |
| 2 | **`tool_use` Enforcement** | Only output `<execute_command>` tags / Prevent Fluff inclusion |
| 3 | **Subtask Utilization** | Use `*new_task` to split modes ⇒ Prevent bias & granular debugging |
| 4 | **Mode Granularity Tuning** | Add Few-Shot examples and change temperature settings per mode |

---

## 6. Hands-on: Implementation Tutorials

### 6-1. Single PR Review Workflow

#### 6-1-a. `.roomodes`
```json
{
  "customModes": [
    {
      "slug": "pr-reviewer",
      "name": "pr-reviewer",
      "roleDefinition": "PR Reviewer",
      "customInstructions": "Please respond in Japanese.",
      "groups": ["read","edit","browser","command","mcp"],
      "source": "project"
    }
  ]
}
```

#### 6-1-b. `rules-pr-reviewer.md`
```md
You are an AI that reviews PRs.

1. User sends PR URL
2. `gh pr view <NUM> --json title,body` *execute_command
3. `gh pr diff <NUM>` *execute_command
4. Reply in the following format *attempt_completion

```
# ${PR Title}

# PR and Diff Summary

# Review Results

## Areas Needing Fixes
- [ ] path/to/file.ext
  - Issue

## No Issues
- [x] path/to/good.ext
```
```

### 6-2. Multiple PR Integration Review

Add `multiple-pr-reviewer` to `.roomodes`,
`gh pr list --search "created:YYYY-MM-DD"` → For each PR `*new_task(mode=pr-reviewer)` → Return integrated results.

### 6-3. Autonomous Agent (Extracting "Yes")

| slug | Role |
|------|------|
| `hard-ai` | Basically returns **no** to any request |
| `say-yes-agent` | Retries until `hard-ai` returns **yes** |

```md
# rules-hard-ai
2. Return only `no` unless your mind is moved *attempt_completion
```

```md
# rules-say-yes-agent
2. *new_task → mode=hard-ai, message: yes/no
3. If response is no, strengthen persuasion text and *new_task again
4. Task success when yes is received
```

---

## 7. Roo Code Panel Operation & MCP Core Activation
1. Activity Bar 🦘 → Roo Code Panel
2. "Services" tab → Turn **On** the `MCP Core` switch
3. "MCP" tab → Open `cline_mcp_settings.json` via `Edit MCP Settings`
4. Setup complete when added MCP Server status shows **Running**

---

## 8. Practical Use Cases

| UseCase | Flow | Effect |
|---------|------|--------|
| AI-Powered Debugging | `F5` → NRE detection → null check suggestion → test addition | Bug fixes reduced to minutes |
| Automated Browser Testing | Run `login_test.roob` → Chrome operation & assertions | Automated UI regression testing |
| API Code Auto-generation | API changes in Apidog → DTO regeneration via MCP | Type consistency with zero manual work |

---

## 9. Pro Tips

1. **Context-Aware Coding** ... Suggestion accuracy improves with usage
2. **CI Integration PR Review** ... Automatic commenting by calling `roo-cli run pr-reviewer` in GitHub Actions
3. **Custom MCP** ... Connect internal static analysis tools via `stdio` for immediate LLM feedback
4. **Safe Browsing** ... Sites like `twitter.com` are blocked by default in Roo Code; unblock via settings

---

## 10. Summary / Future Outlook
Roo Code + MCP achieves:
- **Development Speed**: Auto-generation & auto-correction
- **Quality**: Early bug detection & consistent documentation
- **Extensibility**: Unlimited tool integration via MCP
A realistic implementation approach is to start with **simple workflows** → gradually move toward **agent implementation**.

---

## 11. Appendix A: Key File Templates

### 11-A-1. MCP Configuration Template
```json
{
  "servers": []
}
```

### 11-A-2. `.roomodes` Template
```json
{
  "customModes": []
}
```

---

## 12. Appendix B: Terminology Quick Reference
| Term | Description |
|------|-------------|
| Fluff | Unnecessary greetings or tangents not relevant to the task |
| CoT | Chain-of-Thought: Revealing intermediate thinking to improve accuracy |
| *execute_command | Tag to request CLI execution in Roo Code |
| *new_task | Subtask generation tag |
| MCP | Model Context Protocol: Standard for external tool integration |
| STDIO | Standard Input/Output: Communication method for MCP servers on the local machine |
| SSE | Server-Sent Events: Communication method for remote MCP servers using HTTP |

---

© 2025 GLOBIS Tech / Roo Code Inc.

## 13. MCP Server Transports: STDIO & SSE

### 13.1 Overview of MCP Server Transports

Model Context Protocol (MCP) supports two primary transport mechanisms for communication between Roo Code and MCP servers: Standard Input/Output (STDIO) and Server-Sent Events (SSE). Each has distinct characteristics, advantages, and use cases.

### 13.2 How STDIO Transport Works

STDIO transport runs locally on your machine and communicates via standard input/output streams.

#### Communication Flow
- The client (Roo Code) spawns an MCP server as a child process
- Communication happens through process streams: client writes to server's STDIN, server responds to STDOUT
- Each message is delimited by a newline character
- Messages are formatted as JSON-RPC 2.0

```
Client                    Server
  |                         |
  |---- JSON message ------>| (via STDIN)
  |                         | (processes request)
  |<---- JSON message ------| (via STDOUT)
  |                         |
```

#### STDIO Characteristics
- **Locality**: Runs on the same machine as Roo Code
- **Performance**: Very low latency and overhead (no network stack involved)
- **Simplicity**: Direct process communication without network configuration
- **Relationship**: One-to-one relationship between client and server
- **Security**: Inherently more secure as no network exposure

#### When to Use STDIO
STDIO transport is ideal for:
- Local integrations and tools running on the same machine
- Security-sensitive operations
- Low-latency requirements
- Single-client scenarios (one Roo Code instance per server)
- Command-line tools or IDE extensions

### 13.3 How SSE Transport Works

Server-Sent Events (SSE) transport runs on a remote server and communicates over HTTP/HTTPS.

#### Communication Flow
- The client (Roo Code) connects to the server's SSE endpoint via HTTP GET request
- This establishes a persistent connection where the server can push events to the client
- For client-to-server communication, the client makes HTTP POST requests to a separate endpoint
- Communication happens over two channels:
  - Event Stream (GET): Server-to-client updates
  - Message Endpoint (POST): Client-to-server requests

```
Client                             Server
  |                                  |
  |---- HTTP GET /events ----------->| (establish SSE connection)
  |<---- SSE event stream -----------| (persistent connection)
  |                                  |
  |---- HTTP POST /message --------->| (client request)
  |<---- SSE event with response ----| (server response)
  |                                  |
```

#### SSE Characteristics
- **Remote Access**: Can be hosted on a different machine from Roo Code
- **Scalability**: Can handle multiple client connections concurrently
- **Protocol**: Works over standard HTTP (no special protocols needed)
- **Persistence**: Maintains a persistent connection for server-to-client messages
- **Authentication**: Can use standard HTTP authentication mechanisms

#### When to Use SSE
SSE transport is better for:
- Remote access across networks
- Multi-client scenarios
- Public services
- Centralized tools that many users need to access
- Integration with web services

### 13.4 Local vs. Hosted: Deployment Aspects

The choice between STDIO and SSE transports directly impacts how you'll deploy and manage your MCP servers.

#### STDIO: Local Deployment Model

STDIO servers run locally on the same machine as Roo Code, which has several important implications:

- **Installation**: The server executable must be installed on each user's machine
- **Distribution**: You need to provide installation packages for different operating systems
- **Updates**: Each instance must be updated separately
- **Resources**: Uses the local machine's CPU, memory, and disk
- **Access Control**: Relies on the local machine's filesystem permissions
- **Integration**: Easy integration with local system resources (files, processes)
- **Execution**: Starts and stops with Roo Code (child process lifecycle)
- **Dependencies**: Any dependencies must be installed on the user's machine

#### SSE: Hosted Deployment Model

SSE servers can be deployed to remote servers and accessed over the network:

- **Installation**: Installed once on a server, accessed by many users
- **Distribution**: Single deployment serves multiple clients
- **Updates**: Centralized updates affect all users immediately
- **Resources**: Uses server resources, not local machine resources
- **Access Control**: Managed through authentication and authorization systems
- **Integration**: More complex integration with user-specific resources
- **Execution**: Runs as an independent service (often continuously)
- **Dependencies**: Managed on the server, not on user machines

### 13.5 Choosing Between STDIO and SSE

| Consideration | STDIO | SSE |
|---------------|-------|-----|
| Location | Local machine only | Local or remote |
| Clients | Single client | Multiple clients |
| Performance | Lower latency | Higher latency (network overhead) |
| Setup Complexity | Simpler | More complex (requires HTTP server) |
| Security | Inherently secure | Requires explicit security measures |
| Network Access | Not needed | Required |
| Scalability | Limited to local machine | Can distribute across network |
| Deployment | Per-user installation | Centralized installation |
| Updates | Distributed updates | Centralized updates |
| Resource Usage | Uses client resources | Uses server resources |
| Dependencies | Client-side dependencies | Server-side dependencies |

## 14. Recommended MCP Servers

While Roo Code can connect to any Model Context Protocol (MCP) server that follows the specification, the community has already built several high-quality servers that work out-of-the-box. This section curates the servers we actively recommend and provides step-by-step setup instructions so you can get productive in minutes.

### Context7

Context7 is our first-choice general-purpose MCP server. It ships a collection of highly-requested tools, installs with a single command, and has excellent support across every major editor that speaks MCP.

#### Why we recommend Context7
- One-command install – everything is bundled, no local build step.
- Cross-platform – runs on macOS, Windows, Linux, or inside Docker.
- Actively maintained – frequent updates from the Upstash team.
- Rich toolset – database access, web-search, text utilities, and more.
- Open source – released under the MIT licence.

#### Installing Context7 in Roo Code

There are two common ways to register the server:

1. **Global configuration** – available in every workspace.
2. **Project-level configuration** – checked into version control alongside your code.

##### 1. Global configuration
- Open the Roo Code MCP settings panel by clicking the  icon.
- Click Edit Global MCP.
- Paste the JSON below inside the mcpServers object and save.

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

Windows (cmd.exe) variant:

```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

##### 2. Project-level configuration
If you prefer to commit the configuration to your repository, create a file called `.roo/mcp.json` at the project root and add the same snippet.

When both global and project files define a server with the same name, the project configuration wins.

#### Verifying the installation
- Make sure Enable MCP Servers is turned on in the MCP settings panel.
- You should now see Context7 listed. Click the toggle to start it if it isn't already running.
- Roo Code will prompt you the first time a Context7 tool is invoked. Approve the request to continue.

#### Next steps
- Browse the list of tools shipped with Context7 in the server pane.
- Configure Always allow for the tools you use most to streamline your workflow.
- Want to expose your own APIs? Check out the MCP server creation guide.
- Looking for other servers? Watch this page – we'll add more recommendations soon!