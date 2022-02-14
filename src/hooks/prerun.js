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
const debug = require('debug')('aio-cli-plugin-telemetry')

module.exports = async function (opts) {
  // console.log('prerun ', Date.now() - global.commandHookStartTime)
  global.prerunTimer = Date.now()

  // console.log('opts.argv = ', opts)
  if (opts.argv.indexOf('--no-telemetry') > -1) {
    debug('--no-telemetry flag found. This command will not be tracked.')
    opts.argv.splice(opts.argv.indexOf('--no-telemetry'), 1)
    telemetryLib.disableForCommand()
  }

  if (telemetryLib.isEnabled()) {
    debug('telemetry - prerun hook =>', opts.Command.id)
    telemetryLib.trackEvent('prerun',
      opts.Command.id,
      opts.argv.filter(arg => arg.indexOf('-') === 0).join(','))
  }
}
