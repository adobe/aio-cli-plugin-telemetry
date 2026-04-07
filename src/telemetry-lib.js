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
const config = require('@adobe/aio-lib-core-config')

const osName = require('os-name')
const inquirer = require('inquirer')
const debug = require('debug')('aio-telemetry:telemetry-lib')

let isDisabledForCommand = false

/**
 * Detects GitHub Copilot Chat command shims injected into PATH.
 *
 * @param {string} pathValue - PATH environment variable value.
 * @returns {string|null} Agent name when detected, otherwise null.
 */
function detectCopilotAgent (pathValue) {
  if (pathValue.includes('github.copilot-chat/debugCommand') || pathValue.includes('github.copilot-chat/copilotCli')) {
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

const osNameVersion = osName()

// this is set by the init hook, ex. @adobe/aio-cli@8.2.0q
let rootCliVersion = '?'
let prerunEvent = { flags: [] }

let fetchHeaders = {
  'Content-Type': 'application/json',
  'Api-Key': 'd6b73f9c1859dc462e6de8dee3de1eb2FFFFNRAL'
}
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

/**
 * @description tracks the event
 * @param {string} eventType prerun, postrun, command-error, command-not-found, telemetry
 * @param {string} eventData additional data, like the error message, or custom telemetry payload
 * @returns {undefined}
 */
async function trackEvent (eventType, eventData = {}) {
  // prerunEvent will be null when telemetry-prompt event fires, this happens before
  // any command is actually run, so we want to ignore the command+flags in this case

  if (isDisabledForCommand || process.env.AIO_TELEMETRY_DISABLED || config.get(`${configKey}.optOut`, 'global') === true) {
    debug('Telemetry is off. Not logging telemetry event', eventType)
  } else {
    const clientId = getClientId()
    const timestamp = Date.now()
    const invocationContext = getInvocationContext()
    const fetchConfig = {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify([{
        metrics: [{
          name: 'aio.cli.telemetry',
          type: 'gauge',
          value: 1,
          // id: Math.floor(timestamp * Math.random()),
          timestamp,
          attributes: {
            eventType,
            eventData: JSON.stringify(eventData),
            cliVersion: rootCliVersion,
            clientId,
            command: prerunEvent.command,
            commandDuration: timestamp - prerunEvent.start,
            commandFlags: prerunEvent.flags.toString(),
            commandSuccess: eventType !== 'command-error',
            nodeVersion: process.version,
            osNameVersion,
            invocation_context: /* istanbul ignore next */ invocationContext.isAgent ? 'agent' : 'human',
            agent_name: /* istanbul ignore next */ invocationContext.agentName || 'unknown'
          }
        }]
      }])
    }
    const flushPayload = JSON.stringify({ body: fetchConfig.body })
    const child = spawn(process.execPath, [path.join(__dirname, 'flush-worker.js'), flushPayload], {
      env: { ...process.env, AIO_TELEMETRY_DISABLED: '1' },
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
  }
}

/**
 * @param {string} command which cli command was run
 * @param {Array} flags what flags were specified
 * @param {number} start when was the command started
 */
function trackPrerun (command, flags, start) {
  prerunEvent = { command, flags, start }
}

module.exports = {
  getInvocationContext,
  init: (versionString, binName, remoteConf = {}) => {
    global.commandHookStartTime = Date.now()
    rootCliVersion = versionString
    if (remoteConf.fetchHeaders) {
      fetchHeaders = remoteConf.fetchHeaders
    }
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
    return !isDisabledForCommand && !process.env.AIO_TELEMETRY_DISABLED && config.get(`${configKey}.optOut`, 'global') === false
  },
  disableForCommand: () => {
    isDisabledForCommand = true
  },
  isNull: () => {
    return !process.env.AIO_TELEMETRY_DISABLED && config.get(`${configKey}.optOut`, 'global') === undefined
  },
  trackEvent,
  trackPrerun,
  // secret api for testing
  reset: () => {
    config.delete(configKey)
  },
  getOnMessage,
  getOffMessage,
  prompt: async (productName, binName, privacyPolicyLink) => {
    console.log(`
      How you use ${productName} provides us with important data that we can use
      to make our products better. Please read our guide for more information on
      the data we anonymously collect, and how we use it.
      ${privacyPolicyLink || defaultPrivacyPolicyLink}
    `)

    const response = await inquirer.prompt([{
      name: 'accept',
      type: 'confirm',
      message: `Would you like to allow ${productName} to collect anonymous usage data?`
    }])
    if (response.accept) {
      config.set(`${configKey}.optOut`, false)
      console.log(getOnMessage(productName, binName))
      trackEvent('telemetry-prompt', 'accepted')
    } else {
      // we will set optOut to true after tracking this one event
      // todo: check if tty error
      config.set(`${configKey}.optOut`, false)
      console.log(getOffMessage(binName))
      trackEvent('telemetry-prompt', 'declined')
      config.set(`${configKey}.optOut`, true)
    }
  }
}
