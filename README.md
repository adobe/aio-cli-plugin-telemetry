aio-cli-plugin-telemetry
========================

Adobe Developer cli usage telemetry

[![License](https://img.shields.io/npm/l/@adobe/aio-cli-plugin-telemetry.svg)](https://github.com/adobe/aio-cli-plugin-telemetry/blob/master/package.json)
[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@adobe/aio-cli-plugin-telemetry.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-telemetry)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/aio-cli-plugin-telemetry.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-telemetry)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-cli-plugin-telemetry/master.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-cli-plugin-telemetry/)
[![Github Issues](https://img.shields.io/github/issues/adobe/aio-cli-plugin-telemetry.svg)](https://github.com/adobe/aio-cli-plugin-telemetry/issues)
[![Github Pull Requests](https://img.shields.io/github/issues-pr/adobe/aio-cli-plugin-telemetry.svg)](https://github.com/adobe/aio-cli-plugin-telemetry/pulls) 


# Commands
<!-- commands -->
* [`aio telemetry yes`](#aio-telemetry-yes)

## `aio telemetry yes`

Allow the cli to collect anonymous usage data

```
USAGE
  $ aio telemetry yes
  $ aio telemetry off
  $ aio telemetry

ARGUMENTS
  [STATE]  (on|off|yes|no) set telemetry state

DESCRIPTION
  Allow the cli to collect anonymous usage data
```

_See code: [src/commands/telemetry/index.js](https://github.com/adobe/aio-cli-plugin-telemetry/blob/v2.0.3/src/commands/telemetry/index.js)_
<!-- commandsstop -->

## Configuration
The following values need to be set when this plugin is hosted by different CLIs
- `aioTelemetry`: defined object in root cli package.json with values:
  - `postUrl` : Where to post telemetry data (overrides the default New Relic ingest endpoint)
  - `fetchHeaders`: Headers to send with the telemetry POST request (overrides the default New Relic ingest headers)
  - `productPrivacyPolicyLink`: A link to display to users when prompting to optIn
- `productName`: How to refer to the cli when user is prompted to enable telemetry
  - this value is read from `displayName` or `name` of the cli's package.json
- `productBin`: Output in help text
  - ex. To turn telemetry on run `${productBin} telemetry on`
  - this value is read from 'bin' of the cli's package.json, if the package exports more than 1 bin the first is used

## Opting out via environment variable

Set `AIO_TELEMETRY_DISABLED=1` (or any truthy value) to suppress all telemetry without modifying the persisted opt-in state. Useful for CI pipelines and scripted environments.

```sh
AIO_TELEMETRY_DISABLED=1 aio app deploy
```

## Flush architecture

Telemetry events are sent via a **fire-and-forget detached subprocess** (`src/flush-worker.js`). The parent CLI process spawns the worker and immediately unrefs it, so the CLI exits at its normal time without waiting for the HTTP POST to complete. The worker owns the ingest endpoint and credentials.

## Agent detection

The plugin detects whether the CLI is being invoked by an AI agent or a human by inspecting environment variables at the time of the event. The detected context is included in every event as `invocation_context` (`"agent"` or `"human"`) and `agent_name`.

Supported agents detected automatically:

| Environment variable | Detected agent name |
|---|---|
| `AGENT` | value of the variable (or `"generic"` if `1`/`true`) |
| `AI_AGENT` | value of the variable (or `"generic"` if `1`/`true`) |
| `AIO_AGENT` | `aio-opt-in` |
| `AIO_INVOCATION_CONTEXT=agent` | `aio-opt-in` |
| `CURSOR_AGENT` | `cursor` |
| `CLAUDECODE` / `CLAUDE_CODE` | `claude` |
| `GEMINI_CLI` | `gemini` |
| `CODEX_SANDBOX` | `codex` |
| `AUGMENT_AGENT` | `augment` |
| `CLINE_ACTIVE` | `cline` |
| `OPENCODE_CLIENT` | `opencode` |
| `REPL_ID` | `replit` |
| `PATH` containing `github.copilot-chat` | `github-copilot` |

To opt into agent tracking without setting a tool-specific variable, set `AIO_INVOCATION_CONTEXT=agent`.

## POST data

Events are posted to the New Relic Metric API. Here is an example of the payload:

```json
[{
  "metrics": [{
    "name": "aio.cli.telemetry",
    "type": "gauge",
    "value": 1,
    "timestamp": 1673404918437,
    "attributes": {
      "eventType": "postrun",
      "eventData": "{}",
      "cliVersion": "@adobe/aio-cli@11.0.2",
      "clientId": 264421030538,
      "command": "app:deploy",
      "commandDuration": 5661,
      "commandFlags": "",
      "commandSuccess": true,
      "nodeVersion": "v22.21.1",
      "osNameVersion": "macOS Sequoia 15.4",
      "invocation_context": "human",
      "agent_name": "unknown"
    }
  }]
}]
```
