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
  // console.log('init happened '+ opts.config.name + '@' + opts.config.version + '\n' + Object.keys(opts))
  telemetryLib.setCliVersion(opts.config.name + '@' + opts.config.version)

  // set them both, init is always called, but prerun is not
  global.prerunTimer = global.commandHookStartTime = Date.now()

  // in some cases, the actual prerun hook does not happen, so we will track prerun here also
  // even though it might be overwritten
  telemetryLib.trackPrerun(opts.id,
    opts.argv.filter(arg => arg.indexOf('-') === 0).join(','),
    global.prerunTimer)

  // init event does not post telemetry, it stores some info that will be used later
  // this will prompt to optIn/Out if telemetry.optIn is undefined
  // todo: don't prompt if it is a telemetry command, like `aio telemetry off` should not ask if you want to turn it on first ...
  if ((opts.argv.indexOf('--no-telemetry') < 0) && telemetryLib.isNull()) {
    // let's ask!
    // unfortunately the `oclif-dev readme` run by prepack fires this event, which hangs CI
    if (opts.id !== 'readme') {
      return telemetryLib.prompt()
    }
  }
}
