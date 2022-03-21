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

const fetch = require('node-fetch')
const config = require('@adobe/aio-lib-core-config')
const osName = require('os-name')
const inquirer = require('inquirer')
const debug = require('debug')('aio-telemetry:telemetry-lib')

const postUrl = 'https://dcs.adobedc.net/collection/ffb5bdcefe744485c5c968662012f91293eee10f5dac4ca009beb14d7c028424?asynchronous=true'
let isDisabledForCommand = false

const productName = 'Adobe I/O CLI'
const Messages = {}
Messages.PromptPreamble = `
How you use ${productName} provides us with important data that we can use to make
our products better. Please read our privacy policy for more information on the
data we collect. http://www.adobe.com/privacy.html`

Messages.PromptMessage = `Would you like to allow ${productName} to collect anonymous usage data?`
Messages.TelemetryOffMessage = `
Telemetry is off.
If you would like to turn telemetry on, simply run \`aio telemetry on\``

Messages.TelemetryOnMessage = `
Telemetry is on! Nice, you are helping us improve ${productName}
If you would like to turn telemetry off, simply run \`aio telemetry off\``

const osNameVersion = osName()

// this is set by the init hook, ex. @adobe/aio-cli@8.2.0
let rootCliVersion = '?'
let prerunEvent

/**
 *
 */
function getClientId () {
  let clientId = config.get('aio-cli-telemetry.clientId')
  if (!clientId) {
    clientId = Math.floor(Date.now() * Math.random())
    config.set('aio-cli-telemetry.clientId', clientId)
  }
  return clientId
}

/**
 * @description tracks the event
 * @param {string} eventType prerun, postrun, command-error, command-not-found, telemetry
 * @param {string} eventData additional data, like the error message, or custom telemetry payload
 * @returns null
 */
async function trackEvent (eventType, eventData) {
  // prerunEvent will be null when telemetry-prompt event fires, this happens before
  // any command is actually run, so we want to ignore the command+flags in this case
  //
  if (!prerunEvent) {
    prerunEvent = { command: '', flags: [], start: Date.now() }
  }
  if (isDisabledForCommand || config.get('aio-cli-telemetry.optOut', 'global') === true) {
    debug('Telemetry is off. Not logging telemetry event', eventType)
  } else {
    const clientId = getClientId()
    const timestamp = Date.now()
    const duration = timestamp - prerunEvent.start
    const fetchConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-adobe-flow-id': '6990c252-370b-45d7-99f5-9fc0e5edc0d9',
        'x-api-key': 'adobe_io',
        'sandbox-name': 'developer-lifecycle-dev1'
      }
    }
    fetchConfig.body = JSON.stringify({
      id: Math.floor(timestamp * Math.random()),
      timestamp: timestamp,
      _adobeio: {
        eventType: eventType,
        eventData: eventData,
        cliVersion: rootCliVersion,
        clientId: clientId,
        command: prerunEvent.command,
        commandDuration: duration,
        commandFlags: prerunEvent.flags,
        commandSuccess: eventType !== 'command-error',
        nodeVersion: process.version,
        osNameVersion: osNameVersion
      }
    })
    debug('posting telemetry event', fetchConfig.body)
    try {
      const response = await fetch(postUrl, fetchConfig)
      debug('response.ok = ', response.ok)
    } catch (exc) {
      debug('error reaching telemetry server : ', exc)
    }
  }
}

/**
 * @param command
 * @param flags
 * @param start
 */
function trackPrerun (command, flags, start) {
  prerunEvent = { command, flags, start }
}

module.exports = {
  Messages,
  setCliVersion: (versionString) => {
    rootCliVersion = versionString
    global.commandHookStartTime = Date.now()
  },
  enable: () => {
    config.set('aio-cli-telemetry.optOut', false)
  },
  disable: () => {
    config.set('aio-cli-telemetry.optOut', true)
  },
  isEnabled: () => {
    return !isDisabledForCommand && config.get('aio-cli-telemetry.optOut', 'global') === false
  },
  disableForCommand: () => {
    isDisabledForCommand = true
  },
  isNull: () => {
    return config.get('aio-cli-telemetry.optOut', 'global') === undefined
  },
  trackEvent,
  trackPrerun,
  // secret api for testing
  reset: () => {
    config.delete('aio-cli-telemetry')
  },
  prompt: async () => {
    console.log(Messages.PromptPreamble)
    const response = await inquirer.prompt([{
      name: 'accept',
      type: 'confirm',
      message: Messages.PromptMessage
    }])
    if (response.accept) {
      config.set('aio-cli-telemetry.optOut', false)
      console.log(Messages.TelemetryOnMessage)
      trackEvent('telemetry-prompt', 'accepted')
    } else {
      // we will set optOut to true after tracking this one event
      config.set('aio-cli-telemetry.optOut', false)
      console.log(Messages.TelemetryOffMessage)
      trackEvent('telemetry-prompt', 'declined')
      config.set('aio-cli-telemetry.optOut', true)
    }
  }
}
