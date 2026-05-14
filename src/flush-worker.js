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
 * Telemetry flush worker — spawned as a detached subprocess so the parent CLI can
 * exit immediately without waiting on the HTTP POST.
 *
 * Accepts a single CLI argument: a JSON-encoded object with shape
 * { body: string, postUrl: string, headers?: object } where `body` is a serialised
 * New Relic metric batch array (same shape as the parent builds for fetch), `postUrl`
 * is the App Builder proxy, and `headers` (when present) are optional overrides merged
 * after the worker defaults (never pass secrets such as api-key).
 *
 * Failed deliveries are dropped; telemetry is best-effort and must not affect the CLI.
 */

'use strict'

const debug = require('debug')('aio-telemetry:flush-worker')
const { createFetch } = require('@adobe/aio-lib-core-networking')

const fetch = createFetch()

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
}

/**
 * POSTs the metric batch from argv. Swallows all errors.
 * @returns {Promise<void>}
 */
async function main () {
  let batches
  let postUrl
  let requestHeaders = { ...DEFAULT_HEADERS }
  try {
    const parsed = JSON.parse(process.argv[2])
    const { body, postUrl: url, headers } = parsed
    if (!url || typeof url !== 'string') {
      return
    }
    postUrl = url
    if (headers && typeof headers === 'object') {
      const safe = Object.fromEntries(
        Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'api-key')
      )
      requestHeaders = { ...DEFAULT_HEADERS, ...safe }
    }
    const parsedBody = JSON.parse(body)
    if (!Array.isArray(parsedBody)) {
      return
    }
    batches = parsedBody
  } catch {
    return
  }

  try {
    debug('POST %s requestHeaders=%o', postUrl, requestHeaders)
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ batches })
    })
    if (!res?.ok) {
      const status = res?.status ?? 'unknown'
      debug('telemetry flush non-ok: HTTP %s', status)
    }
  } catch (err) {
    debug('telemetry flush failed: %O', err)
  }
}

/* istanbul ignore next */
if (require.main === module) {
  main()
}

module.exports = { main }
