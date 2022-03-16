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
const debug = require('debug')('aio-telemetry:error')

module.exports = async function (info) {

  console.log('command-error !!! message = ', process.argv.slice(2))
  // console.log('err ', info.config)
  if (telemetryLib.isEnabled()) {
    telemetryLib.trackEvent('error',
      opts.id,
      opts.userAgent)
  }
}