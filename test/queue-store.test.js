/*
 * Copyright 2026 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const path = require('path')
const os = require('os')

jest.mock('fs')
const fs = require('fs')

const queueStore = require('../src/queue-store')

const DEFAULT_QUEUE_PATH = path.join(os.homedir(), '.config', 'aio', '.telemetry-queue.json')
const XDG_QUEUE_PATH = path.join('/xdg-home', 'aio', '.telemetry-queue.json')

describe('queue-store', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    delete process.env.XDG_CONFIG_HOME
  })

  describe('getQueuePath', () => {
    test('returns path under ~/.config/aio when XDG_CONFIG_HOME is not set', () => {
      expect(queueStore.getQueuePath()).toBe(DEFAULT_QUEUE_PATH)
    })

    test('honours XDG_CONFIG_HOME when set', () => {
      process.env.XDG_CONFIG_HOME = '/xdg-home'
      expect(queueStore.getQueuePath()).toBe(XDG_QUEUE_PATH)
      delete process.env.XDG_CONFIG_HOME
    })
  })

  describe('readQueue', () => {
    test('returns parsed array when file contains valid JSON', () => {
      const items = [{ name: 'aio.cli.telemetry', value: 1 }]
      fs.readFileSync.mockReturnValue(JSON.stringify(items))
      expect(queueStore.readQueue()).toEqual(items)
    })

    test('returns empty array when file does not exist', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT') })
      expect(queueStore.readQueue()).toEqual([])
    })

    test('returns empty array when file contains invalid JSON', () => {
      fs.readFileSync.mockReturnValue('not-json{{{')
      expect(queueStore.readQueue()).toEqual([])
    })

    test('returns empty array when parsed value is not an array', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ foo: 'bar' }))
      expect(queueStore.readQueue()).toEqual([])
    })
  })

  describe('writeQueue', () => {
    test('creates directory and writes items as JSON', () => {
      const items = [{ name: 'aio.cli.telemetry', value: 1 }]
      queueStore.writeQueue(items)
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(DEFAULT_QUEUE_PATH), { recursive: true })
      expect(fs.writeFileSync).toHaveBeenCalledWith(DEFAULT_QUEUE_PATH, JSON.stringify(items), 'utf8')
    })

    test('silently ignores write errors', () => {
      fs.mkdirSync.mockImplementation(() => { throw new Error('EACCES') })
      expect(() => queueStore.writeQueue([])).not.toThrow()
    })
  })

  describe('clearQueue', () => {
    test('deletes the queue file', () => {
      queueStore.clearQueue()
      expect(fs.unlinkSync).toHaveBeenCalledWith(DEFAULT_QUEUE_PATH)
    })

    test('silently ignores errors when file does not exist', () => {
      fs.unlinkSync.mockImplementation(() => { throw new Error('ENOENT') })
      expect(() => queueStore.clearQueue()).not.toThrow()
    })
  })
})
