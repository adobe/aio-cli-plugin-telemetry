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

const Insight = require('insight')
const fetch = require('node-fetch')
const debug = require('debug')('aio-telemetry:telemetry-lib')

const postUrl = 'https://dcs.adobedc.net/collection/ffb5bdcefe744485c5c968662012f91293eee10f5dac4ca009beb14d7c028424?asynchronous=true'
let isDisabledForCommand = false

const productName = 'Adobe I/O CLI'
let Messages = {}
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

// Google Analytics tracking code has been replace, not using ga but still using insight
let pkgJson = require('../package.json')
let insight = new Insight({
  trackingCode: 'unused',
  pkg: pkgJson,
})

// this is set by the init hook, ex. @adobe/aio-cli@8.2.0
let rootCliVersion = "?"
let prerunEvent

/**
 * @description tracks the event
 * @param {string} eventType prerun, postrun, command-error, command-not-found, telemetry
 * @param {string} command what command was being run
 * @param {Array<string>} flags on the command line
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
  if (insight.optOut || isDisabledForCommand) {
    debug('Telemetry is off. Not logging telemetry event', eventType)
    return
  } else {
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
      'id': Math.floor(timestamp * Math.random()),
      'timestamp': timestamp,
      '_adobeio': {
        'eventType': eventType,
        'eventData': eventData,
        'cliVersion': rootCliVersion,
        'clientId': insight.clientId,
        'command': prerunEvent.command,
        'commandDuration': duration,
        'commandFlags': prerunEvent.flags,
        'commandSuccess': eventType !== 'command-error',
        'nodeVersion': process.version,
        'osNameVersion': insight.os
      }
    })
    console.log('posting telemetry event:', fetchConfig)
    try {
      const response = await fetch(postUrl, fetchConfig)
      console.log('response.ok = ', eventType, response.ok)
    } catch (exc) {
      console.log('error reaching telemetry server')
    }
  }
}

function trackPrerun (command, flags, start) {
  prerunEvent = { command, flags, start }
}

module.exports = {
  Messages,
  setCliVersion: ( versionString ) => {
    rootCliVersion = versionString
    global.commandHookStartTime = Date.now()
  },
  enable: () => {
    insight.optOut = false
  },
  disable: () => {
    insight.optOut = true
  },
  isEnabled: () => {
    return insight.optOut === false && !isDisabledForCommand
  },
  disableForCommand: () => {
    isDisabledForCommand = true
  },
  isNull: () => {
    return insight.optOut === undefined
  },
  trackEvent,
  trackPrerun,
  // secret api for testing
  reset: () => {
    insight.optOut = undefined
  },
  prompt: resolve => {
    console.log(Messages.PromptPreamble)
    insight.askPermission(Messages.PromptMessage, function (_, optIn) {
      if (optIn) {
        // user has accepted, we will thank them and track this
        insight.optOut = false
        trackEvent('telemetry-prompt', 'accepted')
        console.log(Messages.TelemetryOnMessage)
      }
      else {
        // user has declined, we still want to track this
        insight.optOut = false
        trackEvent('telemetry-prompt','declined')
        insight.optOut = true
        console.log(Messages.TelemetryOffMessage)
      }
      resolve()
    })
  }
}

