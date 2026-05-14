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
 * Persistent queue store for telemetry metrics pending flush or retry.
 *
 * The queue is kept in a dedicated JSON file that lives alongside the main aio
 * config directory but is completely separate from user-visible aio configuration:
 *
 *   ${XDG_CONFIG_HOME:-~/.config}/aio/.telemetry-queue.json
 *
 * Metrics recorded before `postrun` are appended here; the flush worker runs on
 * `postrun`, merges the file with the outgoing postrun batch, POSTs, then clears
 * the file on success or rewrites it on failure for retry. A prior run may also
 * leave failed deliveries in this file for the next flush.
 *
 * Stored metrics are capped at `MAX_QUEUE_METRICS`; older entries are dropped when
 * the limit is exceeded so an unreachable proxy cannot grow the file without bound.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

/** Maximum metric objects in the queue file; oldest are evicted when exceeded. */
const MAX_QUEUE_METRICS = 1000

/**
 * Truncates a metrics array to {@link MAX_QUEUE_METRICS} entries (keeps the newest).
 * @param {unknown} items candidate queue contents (typically an array from JSON)
 * @returns {Array<object>} sanitized array safe to persist
 */
function normalizeQueueItems (items) {
  if (!Array.isArray(items)) {
    return []
  }
  if (items.length <= MAX_QUEUE_METRICS) {
    return items
  }
  return items.slice(-MAX_QUEUE_METRICS)
}

/**
 * Resolves the absolute path to the queue file, honouring XDG_CONFIG_HOME when set.
 * @returns {string} Absolute path to .telemetry-queue.json.
 */
function getQueuePath () {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(base, 'aio', '.telemetry-queue.json')
}

/**
 * Reads the current queue from disk.
 * Returns an empty array when the file does not exist or is unreadable.
 * @returns {Array<object>} Flat array of New Relic metric objects.
 */
function readQueue () {
  const file = getQueuePath()
  try {
    const data = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) {
      return []
    }
    const normalized = normalizeQueueItems(parsed)
    if (parsed.length > normalized.length) {
      try {
        fs.writeFileSync(file, JSON.stringify(normalized), 'utf8')
      } catch {
        // same as writeQueue — never throw from telemetry persistence
      }
    }
    return normalized
  } catch {
    return []
  }
}

/**
 * Persists the given metrics array to the queue file, creating directories as needed.
 * Silently ignores write errors — telemetry must never crash the CLI.
 * @param {Array<object>} items Flat array of New Relic metric objects.
 */
function writeQueue (items) {
  const file = getQueuePath()
  const toWrite = normalizeQueueItems(items)
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(toWrite), 'utf8')
  } catch {
    // silently ignore — failing to persist the queue must not affect the CLI
  }
}

/**
 * Appends metric objects to the end of the queue (read + merge + write).
 * Silently ignores invalid input or write errors.
 * @param {Array<object>} newItems Flat array of New Relic metric objects.
 */
function appendToQueue (newItems) {
  if (!Array.isArray(newItems) || newItems.length === 0) {
    return
  }
  const existing = readQueue()
  writeQueue([...existing, ...newItems])
}

/**
 * Removes the queue file.
 * Silently ignores errors (e.g. the file does not exist).
 */
function clearQueue () {
  try {
    fs.unlinkSync(getQueuePath())
  } catch {
    // silently ignore — queue file may not exist
  }
}

module.exports = {
  getQueuePath,
  readQueue,
  writeQueue,
  appendToQueue,
  clearQueue,
  MAX_QUEUE_METRICS
}
