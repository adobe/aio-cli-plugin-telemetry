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
const debug = require('debug')('aio-telemetry:pre')

module.exports = async function (opts) {
  // we keep globals because we could do some user facing telemetry to tell them how long a command ran
  // even if we don't post this to the telemetry server
  global.prerunTimer = Date.now()
  debug('prerun')
  if (opts.argv.indexOf('--no-telemetry') > -1) {
    debug('--no-telemetry flag found. This command will not be tracked.')
    // remove our flag
    opts.argv.splice(opts.argv.indexOf('--no-telemetry'), 1)
    telemetryLib.disableForCommand()
  } else {
    const flags = opts.argv.filter(arg => arg.indexOf('-') === 0)
    // Potentially we could also store if this command/plugin is `core`
    // and `version` - but we need to evaluate with recent oclif changes
    telemetryLib.trackPrerun(opts.Command.id, flags, global.prerunTimer)
  }
}
