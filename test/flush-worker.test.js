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

const fetch = createFetch()
const { main } = require('../src/flush-worker')

const PROXY = 'https://telemetry-proxy.example/api/v1/web/dx-excshell-1/telemetry'
const METRIC = { name: 'aio.cli.telemetry', type: 'gauge', value: 1, timestamp: 1000, attributes: { eventType: 'postrun' } }
const BODY = JSON.stringify([{ metrics: [METRIC] }])
const flushArg = (body = BODY, extraHeaders) => {
  const base = { body, postUrl: PROXY }
  if (extraHeaders !== undefined) {
    base.headers = extraHeaders
  }
  return JSON.stringify(base)
}

describe('flush-worker main()', () => {
  let origArgv

  beforeEach(() => {
    origArgv = process.argv
    fetch.mockReset()
  })

  afterEach(() => {
    process.argv = origArgv
  })

  test('POSTs batches from payload on success', async () => {
    fetch.mockResolvedValue({ ok: true })

    process.argv = ['node', 'flush-worker.js', flushArg()]
    await main()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe(PROXY)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['Api-Key']).toBeUndefined()

    const posted = JSON.parse(opts.body)
    expect(posted.batches).toHaveLength(1)
    expect(posted.batches[0].metrics).toHaveLength(1)
    expect(posted.batches[0].metrics[0]).toEqual(METRIC)
  })

  test('does not throw when fetch rejects', async () => {
    fetch.mockRejectedValue(new Error('network error'))

    process.argv = ['node', 'flush-worker.js', flushArg()]
    await expect(main()).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('does not throw when fetch resolves with non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 503 })

    process.argv = ['node', 'flush-worker.js', flushArg()]
    await expect(main()).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('does not throw when fetch resolves with ok false and no status', async () => {
    fetch.mockResolvedValue({ ok: false })

    process.argv = ['node', 'flush-worker.js', flushArg()]
    await expect(main()).resolves.toBeUndefined()
  })

  test('does not throw when fetch resolves with undefined response', async () => {
    fetch.mockResolvedValue(undefined)

    process.argv = ['node', 'flush-worker.js', flushArg()]
    await expect(main()).resolves.toBeUndefined()
  })

  test('merges optional payload headers as overrides after defaults', async () => {
    fetch.mockResolvedValue({ ok: true })
    process.argv = ['node', 'flush-worker.js', flushArg(BODY, { 'X-Custom-Proxy': 'unit-test' })]
    await main()
    expect(fetch.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Custom-Proxy': 'unit-test'
      })
    )
  })

  test('returns silently when argv[2] is missing', async () => {
    process.argv = ['node', 'flush-worker.js']
    await main()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('returns silently when argv[2] is malformed JSON', async () => {
    process.argv = ['node', 'flush-worker.js', 'not-json{{{']
    await main()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('returns silently when postUrl is missing', async () => {
    process.argv = ['node', 'flush-worker.js', JSON.stringify({ body: BODY })]
    await main()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('returns silently when body is not a JSON array', async () => {
    process.argv = ['node', 'flush-worker.js', JSON.stringify({ body: '{"foo":1}', postUrl: PROXY })]
    await main()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('uses default headers when headers omitted from payload', async () => {
    fetch.mockResolvedValue({ ok: true })
    process.argv = ['node', 'flush-worker.js', JSON.stringify({ body: BODY, postUrl: PROXY })]
    await main()
    expect(fetch.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json' })
    )
  })
})
