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

let isDisabledForCommand = false

const osNameVersion = osName()

// this is set by the init hook, ex. @adobe/aio-cli@8.2.0
let rootCliVersion = '?'
let prerunEvent = { flags: [] }
// postUrl and fetchHeaders are set by the init hook if these values are set in the root cli package.json
let postUrl = 'https://dcs.adobedc.net/collection/ffb5bdcefe744485c5c968662012f91293eee10f5dac4ca009beb14d7c028424?asynchronous=true'
let fetchHeaders = {
  'Content-Type': 'application/json',
  'x-adobe-flow-id': '18dce8db-f523-4ff1-8806-0719de3fd367',
  'x-api-key': 'adobe_io',
  'sandbox-name': 'developer-lifecycle-dev1'
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
async function trackEvent (eventType, eventData = '') {
  // prerunEvent will be null when telemetry-prompt event fires, this happens before
  // any command is actually run, so we want to ignore the command+flags in this case

  if (isDisabledForCommand || config.get(`${configKey}.optOut`, 'global') === true) {
    debug('Telemetry is off. Not logging telemetry event', eventType)
  } else {
    const clientId = getClientId()
    const timestamp = Date.now()
    const fetchConfig = {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({
        id: Math.floor(timestamp * Math.random()),
        timestamp: timestamp,
        _adobeio: {
          eventType: eventType,
          eventData: eventData,
          cliVersion: rootCliVersion,
          clientId: clientId,
          command: prerunEvent.command,
          commandDuration: timestamp - prerunEvent.start,
          commandFlags: prerunEvent.flags.toString(),
          commandSuccess: eventType !== 'command-error',
          nodeVersion: process.version,
          osNameVersion: osNameVersion
        }
      })
    }
    try {
      debug('posting telemetry event', fetchConfig)
      const response = await fetch(postUrl, fetchConfig)
      debug('response.ok = ', response.ok)
    } catch (exc) {
      debug('error reaching telemetry server : ', exc)
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
}

module.exports = {
  init: (versionString, binName, remoteConf = {}) => {
    global.commandHookStartTime = Date.now()
    rootCliVersion = versionString
    if (remoteConf.fetchHeaders) {
      fetchHeaders = remoteConf.fetchHeaders
    }
    if (remoteConf.postUrl) {
      postUrl = remoteConf.postUrl
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
    return !isDisabledForCommand && config.get(`${configKey}.optOut`, 'global') === false
  },
  disableForCommand: () => {
    isDisabledForCommand = true
  },
  isNull: () => {
    return config.get(`${configKey}.optOut`, 'global') === undefined
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
