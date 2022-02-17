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
const debug = require('debug')('aio-telemetry:telemetry')

module.exports = async function (opts) {
  debug('telemetry hook was called by : ', opts.config.userAgent)
  // opts.id : app:list
  // opts.userAgent : @adobe/aio-cli/8.2.0 darwin-x64 node-v14.18.0

  debug('opts = ', process.argv.slice(2))

  if (telemetryLib.isEnabled()) {
    debug('telemetry - prerun hook =>', opts.Command.id)
    telemetryLib.trackEvent('telemetry-event',
      opts.id,
      opts.userAgent)
  }
}
