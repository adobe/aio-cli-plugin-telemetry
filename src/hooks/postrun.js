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

const telemetryLib = require('../telemetry-lib')
const debug = require('debug')('aio-telemetry:post')

module.exports = async function (opts) {
  const dT = Date.now() - global.prerunTimer
  debug('command time: ', dT)

  if (telemetryLib.isEnabled()) {
    console.log('telemetry - postrun hook =>', opts.Command.id)
    // here we log flags, but not flag values
    telemetryLib.trackEvent('postrun',
      opts.Command.id,
      opts.argv.filter(arg => arg.indexOf('-') === 0).join(','),
      dT)
  }
}