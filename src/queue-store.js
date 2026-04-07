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
 * Persistent queue store for telemetry events that failed to POST.
 *
 * The queue is kept in a dedicated JSON file that lives alongside the main aio
 * config directory but is completely separate from user-visible aio configuration:
 *
 *   ${XDG_CONFIG_HOME:-~/.config}/aio/.telemetry-queue.json
 *
 * On the next CLI invocation the flush worker picks up any queued events, merges
 * them with the new event, and retries the batch. On success the file is removed.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Resolves the absolute path to the queue file, honouring XDG_CONFIG_HOME when set.
 * @returns {string}
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
  try {
    const data = fs.readFileSync(getQueuePath(), 'utf8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
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
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(items), 'utf8')
  } catch {
    // silently ignore — failing to persist the queue must not affect the CLI
  }
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

module.exports = { getQueuePath, readQueue, writeQueue, clearQueue }
