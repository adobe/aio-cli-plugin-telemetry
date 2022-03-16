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
  // todo: enable storing telemetry index/token in root config pjson
  // console.log('opts.config.pjson = ', opts.config.pjson)

  global.commandHookStartTime = Date.now()
  // init event logging is currently disabled as it is similar to prerun
  return new Promise(resolve => {
    if (telemetryLib.isNull()) {
      // let's ask!
      telemetryLib.prompt(resolve)
    } else {
      resolve()
    }
  })
}
