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
let trackingCode = 'UA-139146041-1'

let isDisabledForCommand = false

let Messages = {}
Messages.PromptPreamble = '\nHow you use Adobe I/O CLI provides us with important data that we can use to make\n' +
  'our products better. Please read our privacy policy for more information on the\n' +
  'data we collect. http://www.adobe.com/privacy.html'
Messages.PromptMessage = 'Would you like to allow Adobe I/O CLI to collect anonymous usage data?'
Messages.TelemetryOffMessage = '\nTelemetry is off. \nIf you would like to turn analytics on, simply run `aio telemetry on`\n'
Messages.TelemetryOnMessage = '\nTelemetry is on! Nice, you are helping us improve Adobe I/O CLI.\n' +
  'If you would like to turn analytics off, simply run `aio telemetry off`\n'

// Google Analytics tracking code
let pkgJson = require('../package.json')
let insight = new Insight({
  trackingCode: trackingCode,
  pkg: pkgJson,
})

module.exports = {
  Messages: Messages,
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
  trackEvent: (cat, act, lbl, val) => {
    insight.trackEvent({
      category: cat || 'category',
      action: act || '-',
      label: lbl || '-',
      value: val || 0,
    })
  },
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
        insight.trackEvent({
          category: 'telemetry-prompt',
          action: 'accepted',
          label: '',
        })
        console.log(Messages.TelemetryOnMessage)
      }
      else {
        // user has declined, we still want to track this
        insight.optOut = false
        insight.trackEvent({
          category: 'telemetry-prompt',
          action: 'declined',
          label: '',
        })
        insight.optOut = true
        console.log(Messages.TelemetryOffMessage)
      }
      resolve()
    })
  },
}

