/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { spawn } = require('child_process')
const path = require('path')
const os = require('os')
const config = require('@adobe/aio-lib-core-config')

const debug = require('debug')('aio-telemetry:telemetry-lib')

/** Adobe I/O App Builder web action that forwards CLI metrics to New Relic (ingest key stays server-side). */
const DEFAULT_TELEMETRY_POST_URL = 'https://53444-aioclitelemetryproxy.adobeio-static.net/api/v1/web/dx-excshell-1/telemetry'

/** @returns {boolean} Whether `AIO_TELEMETRY_DISABLED` opts out (only the literal string `"true"`). */
function isEnvTelemetryDisabled () {
  return ['true', '1', 'yes'].includes(process.env.AIO_TELEMETRY_DISABLED)
}

let isDisabledForCommand = false

/** Metrics for non-terminal events in the current command; merged into the POST on a terminal event. */
const pendingCommandMetrics = []

/** Events with no `postrun` after them; each flushes immediately so error telemetry isn't lost. */
const TERMINAL_EVENTS = ['postrun', 'command-error', 'command-not-found']

/** Events that mean the command did not succeed (so `commandSuccess` is false). */
const FAILED_COMMAND_EVENTS = ['command-error', 'command-not-found']

/** Set by `command-not-found` so we can drop the host's immediate `command-error` rethrow of the same typo. */
let commandNotFoundFired = false

/**
 * Detects GitHub Copilot Chat on PATH via the extension id in globalStorage paths (any OS path separator).
 *
 * @param {string|null|undefined} [pathValue] - PATH environment variable value.
 * @returns {string|null} Agent name when detected, otherwise null.
 */
function detectCopilotAgent (pathValue) {
  if (!pathValue) return null
  // Extension id appears in globalStorage paths on all platforms; do not tie to '/' (Windows uses '\').
  if (pathValue.includes('github.copilot-chat')) {
    return 'github-copilot'
  }
  return null
}

// TODO: detect VSCODE run as an agent
/**
 * Environment variables checked for agent detection (proposed standard first, then tool-specific).
 * Used for metrics only. See aio-cli README "Agent detection" for full list.
 */
const AGENT_ENV_VARS = [
  { env: 'AGENT', name: (v) => (v && v !== '1' && v !== 'true' ? String(v).toLowerCase() : 'generic') },
  { env: 'AI_AGENT', name: (v) => (v && v !== '1' && v !== 'true' ? String(v).toLowerCase() : 'generic') },
  { env: 'AIO_AGENT', name: () => 'aio-opt-in' },
  { env: 'AIO_INVOCATION_CONTEXT', name: (v) => (v === 'agent' ? 'aio-opt-in' : null) },
  { env: 'CURSOR_AGENT', name: () => 'cursor' },
  { env: 'CLAUDECODE', name: () => 'claude' },
  { env: 'CLAUDE_CODE', name: () => 'claude' },
  { env: 'GEMINI_CLI', name: () => 'gemini' },
  { env: 'CODEX_SANDBOX', name: () => 'codex' },
  { env: 'AUGMENT_AGENT', name: () => 'augment' },
  { env: 'CLINE_ACTIVE', name: () => 'cline' },
  { env: 'OPENCODE_CLIENT', name: () => 'opencode' },
  { env: 'PATH', name: detectCopilotAgent },
  { env: 'REPL_ID', name: () => 'replit' }
]

/**
 * Detects whether the CLI is being invoked by an AI agent (vs a human) using env vars.
 * Used for metrics only.
 *
 * @param {object} [env] - Environment object to read (defaults to process.env when omitted).
 * @returns {{ isAgent: boolean, agentName: string|null }} Invocation context metadata.
 */
function getInvocationContext (env) {
  const envToUse = env !== undefined ? env : process.env
  for (const { env: key, name } of AGENT_ENV_VARS) {
    const value = envToUse[key]
    if (value !== undefined && value !== '') {
      const agentName = name(value)
      if (agentName) {
        return { isAgent: true, agentName }
      }
    }
  }
  return { isAgent: false, agentName: null }
}

const osNameVersion = `${os.type()} ${os.release()}`

// this is set by the init hook, ex. @adobe/aio-cli@8.2.0
let rootCliVersion = '?'
let prerunEvent = { flags: [] }

/** @type {Record<string, string>} Host-only headers from `aioTelemetry.fetchHeaders` (passed to flush worker as overrides). */
let extraFetchHeaders = {}
/** @type {string} Resolved proxy URL (defaults at module load; init may override). */
let postUrl = DEFAULT_TELEMETRY_POST_URL
let configKey = 'aio-cli-telemetry'

const defaultPrivacyPolicyLink = 'https://developer.adobe.com/app-builder/docs/guides/telemetry/'

/**
 * @returns {string} clientId fetch or generate clientId and return it
 */
function getClientId () {
  let clientId = config.get(`${configKey}.clientId`)
  if (!clientId) {
    clientId = Math.floor(Date.now() * Math.random())
    config.set(`${configKey}.clientId`, clientId)
  }
  return clientId
}

const getOnMessage = (productName, binName) => {
  return `Telemetry is on! Nice, you are helping us improve ${productName} \nIf you would like to turn telemetry off, simply run \`${binName} telemetry off\``
}
const getOffMessage = (binName) => {
  return `\nTelemetry is off.\nIf you would like to turn telemetry on, simply run \`${binName} telemetry on\``
}
const getNoticeMessage = (productName, privacyPolicyLink) => {
  return `${productName} collects anonymous usage data to help us improve our products.\n` +
    `Telemetry is on by default; read what we collect and how it is used here: ${privacyPolicyLink || defaultPrivacyPolicyLink}`
}

/**
 * Builds the value stored in the metric `eventData` attribute. For `postrun`, an empty object is
 * replaced with `{ durationMs }` from `global.prerunTimer` so older CLIs / hooks that omit the
 * second argument still send timing.
 *
 * @param {string} eventType - telemetry event name (e.g. postrun, command-error)
 * @param {object|string|number|undefined} raw - argument passed to trackEvent
 * @returns {object|string|number} payload serialized into the metric attribute
 */
function resolveEventData (eventType, raw) {
  if (eventType !== 'postrun') {
    return raw === undefined ? {} : raw
  }
  const empty = raw === undefined || raw === null ||
    (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)
  if (!empty) {
    return raw
  }
  if (typeof global.prerunTimer === 'number') {
    return { durationMs: Date.now() - global.prerunTimer }
  }
  return {}
}

/**
 * Serializes `eventData` for the metric `eventData` attribute (a string on the wire).
 * Objects and arrays use `JSON.stringify`; string primitives are not double-encoded
 * (so e.g. telemetry-prompt `"accepted"` stays `accepted`, not `"\"accepted\""`).
 *
 * @param {object|string|number|boolean|undefined|null} eventData - resolved payload from {@link resolveEventData}
 * @returns {string} Serialized value for the metric `eventData` attribute (JSON for objects/arrays; plain text for strings).
 */
function formatEventDataAttribute (eventData) {
  if (eventData === undefined) {
    return '{}'
  }
  if (typeof eventData === 'string') {
    return eventData
  }
  if (['number', 'boolean', 'bigint'].includes(typeof eventData)) {
    return String(eventData)
  }
  if (typeof eventData === 'object') {
    return JSON.stringify(eventData)
  }
  return String(eventData)
}

/**
 * Records a telemetry event. Non-terminal metrics are held in memory and sent in a single
 * batched POST on the next terminal event (`postrun`, `command-error`, `command-not-found`).
 * When enabled, the flush worker is detached so the CLI never waits on the network; failed
 * deliveries are dropped (no disk queue).
 *
 * @param {string} eventType prerun, postrun, command-error, command-not-found, telemetry
 * @param {object|string|number|undefined} [rawEventData] Optional hook payload (e.g. `{ message }` on errors).
 *   Command/flags/duration are also sent as separate metric attributes from prerun/postrun.
 * @returns {undefined}
 */
async function trackEvent (eventType, rawEventData = {}) {
  // prerunEvent is minimal before prerun; telemetry-prompt and similar fire before a command runs.

  const eventData = resolveEventData(eventType, rawEventData)

  const optedOut = isDisabledForCommand || isEnvTelemetryDisabled() || config.get(`${configKey}.optOut`, 'global') === true
  const willSend = !optedOut
  debug(`trackEvent ${eventType} eventData=${JSON.stringify(eventData)} postUrl=${postUrl} willSend=${willSend}`)

  if (optedOut) {
    pendingCommandMetrics.length = 0
    debug('Telemetry is off. Not logging telemetry event', eventType)
  } else {
    const clientId = getClientId()
    const timestamp = Date.now()
    const invocationContext = getInvocationContext()
    const metric = {
      name: 'aio.cli.telemetry',
      type: 'gauge',
      value: 1,
      timestamp,
      attributes: {
        // NB: the wire attribute is `eventName`, not `eventType` — `eventType` is a New Relic
        // reserved word and is dropped on Metric API ingest, so it is unqueryable in NRQL.
        eventName: eventType,
        eventData: formatEventDataAttribute(eventData),
        cliVersion: rootCliVersion,
        clientId,
        command: prerunEvent.command,
        commandDuration: timestamp - prerunEvent.start,
        commandFlags: prerunEvent.flags.toString(),
        commandSuccess: !FAILED_COMMAND_EVENTS.includes(eventType),
        nodeVersion: process.version,
        osNameVersion,
        invocation_context: /* istanbul ignore next */ invocationContext.isAgent ? 'agent' : 'human',
        agent_name: /* istanbul ignore next */ invocationContext.agentName || 'unknown'
      }
    }

    // Non-terminal events buffer; terminal events flush (oclif runs no postrun after error/not-found).
    if (!TERMINAL_EVENTS.includes(eventType)) {
      pendingCommandMetrics.push(metric)
      return
    }

    // A typo fires command-not-found, then the host rethrows it as command-error; drop that rethrow.
    if (eventType === 'command-not-found') {
      commandNotFoundFired = true
    } else if (eventType === 'command-error' && commandNotFoundFired) {
      commandNotFoundFired = false
      debug('dropping command-error that rethrows a command-not-found (same typo)')
      return
    }

    const mergedMetrics = [...pendingCommandMetrics, metric]
    pendingCommandMetrics.length = 0
    const mergedBody = JSON.stringify([{ metrics: mergedMetrics }])

    const flushPayload = JSON.stringify({
      body: mergedBody,
      postUrl,
      ...(Object.keys(extraFetchHeaders).length > 0 && { headers: { ...extraFetchHeaders } })
    })
    try {
      // Omit `env`: child inherits `process.env` (proxy / TLS vars for fetch in the worker).
      const child = spawn(process.execPath, [path.join(__dirname, 'flush-worker.js'), flushPayload], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
    } catch (err) {
      debug('Failed to launch telemetry flush worker: %O', err)
    }
  }
}

/**
 * @param {string} command which cli command was run
 * @param {Array} flags what flags were specified
 * @param {number} start when was the command started
 */
function trackPrerun (command, flags, start) {
  prerunEvent = { command, flags, start }
  // A real command is now running (e.g. an accepted "did you mean" suggestion), so its errors count.
  commandNotFoundFired = false
}

module.exports = {
  getInvocationContext,
  init: (versionString, binName, remoteConf = {}) => {
    pendingCommandMetrics.length = 0
    commandNotFoundFired = false
    global.commandHookStartTime = Date.now()
    rootCliVersion = versionString
    postUrl = remoteConf.postUrl || process.env.AIO_TELEMETRY_POST_URL || DEFAULT_TELEMETRY_POST_URL
    const rawExtra = remoteConf.fetchHeaders && typeof remoteConf.fetchHeaders === 'object'
      ? remoteConf.fetchHeaders
      : {}
    const BLOCKED_HEADERS = new Set(['api-key', 'authorization', 'x-api-key', 'x-ingest-key'])
    extraFetchHeaders = Object.fromEntries(
      Object.entries(rawExtra).filter(([key]) => !BLOCKED_HEADERS.has(key.toLowerCase()))
    )
    configKey = binName + '-cli-telemetry'
  },
  getClientId,
  enable: () => {
    config.set(`${configKey}.optOut`, false)
  },
  disable: () => {
    config.set(`${configKey}.optOut`, true)
  },
  isEnabled: () => {
    return !isDisabledForCommand && !isEnvTelemetryDisabled() && config.get(`${configKey}.optOut`, 'global') !== true
  },
  disableForCommand: () => {
    isDisabledForCommand = true
  },
  isNull: () => {
    return !isEnvTelemetryDisabled() && config.get(`${configKey}.optOut`, 'global') === undefined
  },
  trackEvent,
  trackPrerun,
  // secret api for testing
  DEFAULT_TELEMETRY_POST_URL,
  resolveEventData,
  formatEventDataAttribute,
  reset: () => {
    pendingCommandMetrics.length = 0
    config.delete(configKey)
  },
  getOnMessage,
  getOffMessage,
  getNoticeMessage,
  notice: (productName, privacyPolicyLink) => {
    console.log(getNoticeMessage(productName, privacyPolicyLink))
    config.set(`${configKey}.optOut`, false)
    trackEvent('telemetry-notice', 'shown')
  }
}
