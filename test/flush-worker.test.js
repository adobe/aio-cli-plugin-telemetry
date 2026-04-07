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

const { createFetch } = require('@adobe/aio-lib-core-networking')

jest.mock('../src/queue-store', () => ({
  readQueue: jest.fn(() => []),
  writeQueue: jest.fn(),
  clearQueue: jest.fn()
}))

const fetch = createFetch()
const { readQueue, writeQueue, clearQueue } = require('../src/queue-store')
const { main } = require('../src/flush-worker')

const METRIC = { name: 'aio.cli.telemetry', type: 'gauge', value: 1, timestamp: 1000, attributes: { eventType: 'postrun' } }
const BODY = JSON.stringify([{ metrics: [METRIC] }])

describe('flush-worker main()', () => {
  let origArgv

  beforeEach(() => {
    origArgv = process.argv
    fetch.mockReset()
    readQueue.mockClear()
    writeQueue.mockClear()
    clearQueue.mockClear()
  })

  afterEach(() => {
    process.argv = origArgv
  })

  test('POSTs merged metrics and clears queue on success', async () => {
    const queued = [{ name: 'aio.cli.telemetry', value: 1, attributes: { eventType: 'prerun' } }]
    readQueue.mockReturnValue(queued)
    fetch.mockResolvedValue({ ok: true })

    process.argv = ['node', 'flush-worker.js', JSON.stringify({ body: BODY })]
    await main()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://metric-api.newrelic.com/metric/v1')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Api-Key']).toBeTruthy()

    const posted = JSON.parse(opts.body)
    expect(posted[0].metrics).toHaveLength(2)
    expect(posted[0].metrics[0]).toEqual(queued[0])
    expect(posted[0].metrics[1]).toEqual(METRIC)

    expect(clearQueue).toHaveBeenCalledTimes(1)
    expect(writeQueue).not.toHaveBeenCalled()
  })

  test('writes merged metrics to queue on fetch failure', async () => {
    readQueue.mockReturnValue([])
    fetch.mockRejectedValue(new Error('network error'))

    process.argv = ['node', 'flush-worker.js', JSON.stringify({ body: BODY })]
    await main()

    expect(writeQueue).toHaveBeenCalledTimes(1)
    expect(writeQueue).toHaveBeenCalledWith([METRIC])
    expect(clearQueue).not.toHaveBeenCalled()
  })

  test('merges empty queue with current event', async () => {
    readQueue.mockReturnValue([])
    fetch.mockResolvedValue({ ok: true })

    process.argv = ['node', 'flush-worker.js', JSON.stringify({ body: BODY })]
    await main()

    const posted = JSON.parse(fetch.mock.calls[0][1].body)
    expect(posted[0].metrics).toHaveLength(1)
    expect(posted[0].metrics[0]).toEqual(METRIC)
    expect(clearQueue).toHaveBeenCalledTimes(1)
  })

  test('returns silently when argv[2] is missing', async () => {
    process.argv = ['node', 'flush-worker.js']
    await main()
    expect(fetch).not.toHaveBeenCalled()
    expect(writeQueue).not.toHaveBeenCalled()
  })

  test('returns silently when argv[2] is malformed JSON', async () => {
    process.argv = ['node', 'flush-worker.js', 'not-json{{{']
    await main()
    expect(fetch).not.toHaveBeenCalled()
    expect(writeQueue).not.toHaveBeenCalled()
  })
})
