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
 * Accepts a single CLI argument: a JSON-encoded object with shape { body: string }
 * where body is a serialised New Relic metric payload (array of metric batches).
 *
 * On each run the worker merges any previously-failed events from the persistent
 * queue (src/queue-store.js) with the current event before POSTing. On success
 * the queue is cleared; on failure the merged set is written back so the next
 * invocation can retry.
 */

'use strict'

const { createFetch } = require('@adobe/aio-lib-core-networking')
const { readQueue, writeQueue, clearQueue } = require('./queue-store')

const fetch = createFetch()

const POST_URL = 'https://metric-api.newrelic.com/metric/v1'
const FETCH_HEADERS = {
  'Content-Type': 'application/json',
  // New Relic ingest key — write-only, cannot read data or access any other system.
  'Api-Key': 'd6b73f9c1859dc462e6de8dee3de1eb2FFFFNRAL'
}

/**
 * Reads the persistent queue, merges it with the current event, POSTs the batch,
 * and either clears the queue on success or writes back on failure for retry.
 * @returns {Promise<void>}
 */
async function main () {
  // Parse the current event payload passed by the parent process.
  let currentMetrics
  try {
    const { body } = JSON.parse(process.argv[2])
    currentMetrics = JSON.parse(body)[0].metrics
  } catch {
    // Malformed argument — nothing useful to do.
    return
  }

  // Merge previously-queued metrics (if any) with the current event so they
  // are all retried in a single POST.
  const queuedMetrics = readQueue()
  const allMetrics = [...queuedMetrics, ...currentMetrics]

  try {
    await fetch(POST_URL, {
      method: 'POST',
      headers: FETCH_HEADERS,
      body: JSON.stringify([{ metrics: allMetrics }])
    })
    // Successful delivery — the queue is no longer needed.
    clearQueue()
  } catch {
    // Network failure — persist all metrics so the next invocation can retry.
    writeQueue(allMetrics)
  }
}

/* istanbul ignore next */
if (require.main === module) {
  main()
}

module.exports = { main }
