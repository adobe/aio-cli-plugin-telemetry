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

/**
 * todo:
 * telemetry event is an optional event, so it can come from any other command by firing a hook
 * the things we want to track with this will vary so this needs to be refactored to include
 * {other} data than the normal events we track
 * things tracked here could be things like:
 *  - user created app from template
 *  - user stored log-forwarding config
 *  - user used feature flag
 *  - user installed something we want to track
 *  - that thing we never thought would happen did
 * this event should not cause a telemetry prompt to popup, if telemetry is off it should
 * just be ignored
 */

module.exports = async function ({ data }) {
  await telemetryLib.trackEvent('telemetry-custom-event', data)
}
