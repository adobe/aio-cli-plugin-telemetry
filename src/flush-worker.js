/*
Copyright 2026 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * Telemetry flush worker — spawned as a detached subprocess by trackEvent so
 * the parent process can exit immediately without waiting on the HTTP POST.
 *
 * Accepts a single CLI argument: a JSON-encoded object with shape { body: string }.
 * The endpoint URL and auth headers are owned here so they never appear in
 * process arguments (ps aux) or are passed across the IPC boundary.
 */

'use strict'

const { createFetch } = require('@adobe/aio-lib-core-networking')
const fetch = createFetch()

const POST_URL = 'https://metric-api.newrelic.com/metric/v1'
const FETCH_HEADERS = {
  'Content-Type': 'application/json',
  // New Relic ingest key — write-only, cannot read data or access any other system.
  'Api-Key': 'd6b73f9c1859dc462e6de8dee3de1eb2FFFFNRAL'
}

async function main () {
  try {
    const { body } = JSON.parse(process.argv[2])
    await fetch(POST_URL, {
      method: 'POST',
      headers: FETCH_HEADERS,
      body
    })
  } catch (e) {
    // silently ignore — telemetry errors should never surface to users
  }
}

main()
