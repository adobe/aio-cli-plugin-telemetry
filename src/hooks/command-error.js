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

/*
  we don't need to track anything other than the error itself, the command + flags were stored in prerun
  if there was a --no-telemetry flag then this call will be ignored by telemetryLib
*/
module.exports = async function ({ message }) {
  debug('tracking command-error =>', message)
  await telemetryLib.trackEvent('command-error', { message })
}
