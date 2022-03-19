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

module.exports = async function (opts) {
  telemetryLib.setCliVersion(opts.config.name + '@' + opts.config.version)
  global.commandHookStartTime = Date.now()
  // init event does not post telemetry, it stores some info that will be used later
  // this will prompt to optIn/Out if telemetry.optIn is undefined
  // todo: don't prompt if it is a telemetry command, like `aio telemetry off` should not ask if you want to turn it on first ...
  if ((opts.argv.indexOf('--no-telemetry') < 0) && telemetryLib.isNull()) {
    // let's ask!
    return telemetryLib.prompt()
  } 
}
