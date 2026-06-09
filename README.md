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

_See code: [src/commands/telemetry/index.js](https://github.com/adobe/aio-cli-plugin-telemetry/blob/v2.1.0/src/commands/telemetry/index.js)_
<!-- commandsstop -->

## Configuration

When this plugin is hosted by different CLIs:

- `aioTelemetry` (optional object in the root `package.json` of the **host CLI** — the same `pjson` oclif passes into the init hook):
  - `postUrl` (optional string): HTTPS URL of the telemetry proxy that receives POSTed metric batches. Use this when your CLI should send telemetry to a different App Builder action or gateway than the plugin default.
  - `fetchHeaders`: Optional extra headers merged into telemetry requests (`Content-Type` is always set)
  - `productPrivacyPolicyLink`: A link shown in the one-time telemetry notice (what is collected and how to opt out)
- `productName`: How to refer to the CLI in the telemetry notice (from `displayName` or `name` in `package.json`)
- `productBin`: Shown in help text (from `bin` in `package.json`; if several bins exist, the first is used). Example: run `${productBin} telemetry on`

### Overriding the telemetry POST URL

Resolution order (first match wins):

1. **`aioTelemetry.postUrl`** in the host CLI `package.json`
2. **`AIO_TELEMETRY_POST_URL`** environment variable (non-empty string)
3. **Built-in default** in the plugin (`DEFAULT_TELEMETRY_POST_URL` in [`src/telemetry-lib.js`](https://github.com/adobe/aio-cli-plugin-telemetry/blob/master/src/telemetry-lib.js))

Host `package.json` example:

```json
{
  "name": "my-cli",
  "bin": { "mycli": "./bin/run.js" },
  "aioTelemetry": {
    "postUrl": "https://<namespace>-<project>.adobeio-static.net/api/v1/web/<package>/<action>"
  }
}
```

Environment override (no `package.json` change; useful for CI, staging, or local proxy debugging):

```sh
export AIO_TELEMETRY_POST_URL='https://<namespace>-<project>.adobeio-static.net/api/v1/web/<package>/<action>'
mycli app deploy
```

The resolved URL is passed to the flush worker on each telemetry send; it applies for the rest of that CLI process after `init` runs.

## Opting out via environment variable

Telemetry is suppressed when `AIO_TELEMETRY_DISABLED` is set to one of **`true`**, **`1`**, or **`yes`** (exact match; case-sensitive). Other values such as `0`, `false`, `no`, or an empty string do **not** disable telemetry via this variable.

This does not change the persisted opt-out state. Useful for CI pipelines and scripted environments.

```sh
AIO_TELEMETRY_DISABLED=true aio app deploy
AIO_TELEMETRY_DISABLED=1 aio app deploy
AIO_TELEMETRY_DISABLED=yes aio app deploy
```

## Flush architecture

Telemetry is **best-effort**: events are not persisted when the proxy is down or the network fails.

A flush happens on a **terminal event** — `postrun` (command succeeded), `command-error` (command threw), or `command-not-found`. oclif runs `postrun` only on success, so `command-error`/`command-not-found` must flush on their own; otherwise error telemetry (the most valuable signal) would be buffered and silently dropped on exit. On a terminal event, any in-memory metrics from earlier hooks in the same command are merged with the terminal metric and the combined batch is handed off to a **fire-and-forget detached subprocess** (`src/flush-worker.js`). The parent CLI spawns the worker and immediately `unref()`s it, so the CLI can exit without waiting for the HTTP POST. If the POST fails (network error or non-2xx response), the batch is dropped; telemetry must not block or slow normal CLI use.

Non-terminal events (for example `telemetry-notice`) are held in an **in-memory buffer** until the next terminal event flushes them. If the process exits before any terminal event (crash, `SIGKILL`), buffered events are lost. The buffer is cleared when telemetry is disabled or when `init` runs again (new command session).

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

The `eventData` attribute is always a string. Objects and arrays are stored as a JSON text (e.g. `"{}"`, `"{\"message\":\"…\"}"`). String payloads (such as the telemetry notice outcome `shown`) are stored as that plain text without an extra layer of JSON quoting. Numbers and booleans use their usual string forms (`"0"`, `"false"`).

Example shape of the metric payload:

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
