/*
 * Copyright 2022 Adobe Inc. All rights reserved.
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
const telemetryLib = require('../src/telemetry-lib')
const config = require('@adobe/aio-lib-core-config')
const queueStore = require('../src/queue-store')

jest.mock('@adobe/aio-lib-core-config')
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({ unref: jest.fn() }))
}))

const fetch = createFetch()
const { spawn } = require('child_process')

describe('telemetry-lib', () => {
  beforeAll(() => {
    jest.spyOn(queueStore, 'appendToQueue').mockImplementation(() => {})
  })

  afterAll(() => {
    queueStore.appendToQueue.mockRestore()
  })

  beforeEach(() => {
    jest.resetModules()
    fetch.mockReset()
    spawn.mockClear()
    queueStore.appendToQueue.mockClear()
  })

  test('exports messages', async () => {
    expect(telemetryLib.getOffMessage).toBeDefined()
    expect(telemetryLib.getOffMessage).toBeInstanceOf(Function)

    expect(telemetryLib.getOnMessage).toBeDefined()
    expect(telemetryLib.getOnMessage).toBeInstanceOf(Function)
  })

  test('exports init function', async () => {
    expect(telemetryLib.init).toBeDefined()
    expect(telemetryLib.init).toBeInstanceOf(Function)
    telemetryLib.init('a@4', 'binTest', {})
    telemetryLib.enable()
    expect(config.set).toHaveBeenCalledWith('binTest-cli-telemetry.optOut', false)
    telemetryLib.disable()
    expect(config.set).toHaveBeenCalledWith('binTest-cli-telemetry.optOut', true)
  })

  test('trackEvent does not throw when spawn fails while launching flush worker', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binSpawnFail', {})
    spawn.mockImplementationOnce(() => {
      throw new Error('spawn EPERM')
    })
    await expect(telemetryLib.trackEvent('postrun')).resolves.toBeUndefined()
  })

  test('uses client id from config when queueing non-postrun events', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest2', {})
    await telemetryLib.trackEvent('telemetry-custom-event')
    expect(config.get).toHaveBeenCalledWith('binTest2-cli-telemetry.clientId')
    expect(config.get).toHaveBeenCalledWith('binTest2-cli-telemetry.optOut', 'global')
    expect(spawn).not.toHaveBeenCalled()
    expect(queueStore.appendToQueue).toHaveBeenCalledTimes(1)
    const appended = queueStore.appendToQueue.mock.calls[0][0]
    expect(appended).toHaveLength(1)
    expect(JSON.stringify(appended[0])).toContain('"clientId":"clientidxyz"')
  })

  test('postrun adds durationMs to eventData when the hook omits payload and prerunTimer is set', async () => {
    global.prerunTimer = Date.now() - 40
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binDur', {})
    await telemetryLib.trackEvent('postrun')
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    const ed = JSON.parse(body[0].metrics[0].attributes.eventData)
    expect(ed.durationMs).toBeGreaterThanOrEqual(35)
    expect(ed.durationMs).toBeLessThan(60000)
  })

  test('postrun keeps non-empty eventData as-is', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binKeep', {})
    await telemetryLib.trackEvent('postrun', { source: 'test' })
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    expect(JSON.parse(body[0].metrics[0].attributes.eventData)).toEqual({ source: 'test' })
  })

  test('postrun eventData is {} when payload empty and prerunTimer is not a number', async () => {
    const prev = global.prerunTimer
    delete global.prerunTimer
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binNoTimer', {})
    await telemetryLib.trackEvent('postrun')
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    expect(body[0].metrics[0].attributes.eventData).toBe('{}')
    global.prerunTimer = prev
  })

  test('trackEvent includes invocation_context and agent_name in payload', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest', {})
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    const attributes = body[0].metrics[0].attributes
    expect(attributes).toHaveProperty('invocation_context')
    expect(attributes).toHaveProperty('agent_name')
    expect(['agent', 'human']).toContain(attributes.invocation_context)
  })

  test('init uses built-in default postUrl when host omits aioTelemetry.postUrl and env', async () => {
    const orig = process.env.AIO_TELEMETRY_POST_URL
    delete process.env.AIO_TELEMETRY_POST_URL
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binDefaultUrl', {})
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    expect(flushPayload.postUrl).toBe(telemetryLib.DEFAULT_TELEMETRY_POST_URL)
    if (orig !== undefined) process.env.AIO_TELEMETRY_POST_URL = orig
  })

  test('init uses AIO_TELEMETRY_POST_URL when remoteConf.postUrl is omitted', async () => {
    const orig = process.env.AIO_TELEMETRY_POST_URL
    process.env.AIO_TELEMETRY_POST_URL = 'https://env.example/ingest'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binEnv', {})
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    expect(flushPayload.postUrl).toBe('https://env.example/ingest')
    if (orig !== undefined) process.env.AIO_TELEMETRY_POST_URL = orig
    else delete process.env.AIO_TELEMETRY_POST_URL
  })

  test('init with two args defaults remoteConf and uses AIO_TELEMETRY_POST_URL', async () => {
    const orig = process.env.AIO_TELEMETRY_POST_URL
    process.env.AIO_TELEMETRY_POST_URL = 'https://env-default.example/ingest'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTwoArg')
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    expect(flushPayload.postUrl).toBe('https://env-default.example/ingest')
    if (orig !== undefined) process.env.AIO_TELEMETRY_POST_URL = orig
    else delete process.env.AIO_TELEMETRY_POST_URL
  })

  test('remoteConf.postUrl takes precedence over AIO_TELEMETRY_POST_URL', async () => {
    const orig = process.env.AIO_TELEMETRY_POST_URL
    process.env.AIO_TELEMETRY_POST_URL = 'https://env.example/ingest'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binPrec', { postUrl: 'https://cli-config.example/proxy' })
    await telemetryLib.trackEvent('postrun')
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    expect(flushPayload.postUrl).toBe('https://cli-config.example/proxy')
    if (orig !== undefined) process.env.AIO_TELEMETRY_POST_URL = orig
    else delete process.env.AIO_TELEMETRY_POST_URL
  })

  test('trackEvent does not post when AIO_TELEMETRY_DISABLED is set', async () => {
    const orig = process.env.AIO_TELEMETRY_DISABLED
    process.env.AIO_TELEMETRY_DISABLED = '1'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest', {})
    await telemetryLib.trackEvent('postrun')
    expect(spawn).not.toHaveBeenCalled()
    if (orig !== undefined) process.env.AIO_TELEMETRY_DISABLED = orig
    else delete process.env.AIO_TELEMETRY_DISABLED
  })

  test('trackEvent does not queue when AIO_TELEMETRY_DISABLED is set for non-postrun', async () => {
    const orig = process.env.AIO_TELEMETRY_DISABLED
    process.env.AIO_TELEMETRY_DISABLED = '1'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binNoQueue', {})
    await telemetryLib.trackEvent('command-error', { message: 'x' })
    expect(queueStore.appendToQueue).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    if (orig !== undefined) process.env.AIO_TELEMETRY_DISABLED = orig
    else delete process.env.AIO_TELEMETRY_DISABLED
  })

  test('string eventData is stored without extra JSON quotes when queueing', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binStrEd', {})
    await telemetryLib.trackEvent('telemetry-prompt', 'accepted')
    expect(queueStore.appendToQueue).toHaveBeenCalledTimes(1)
    const metric = queueStore.appendToQueue.mock.calls[0][0][0]
    expect(metric.attributes.eventData).toBe('accepted')
    expect(metric.attributes.eventData).not.toMatch(/^"/)
  })

  test('trackEvent sends agent context when CURSOR_AGENT env is set', async () => {
    const orig = process.env.CURSOR_AGENT
    process.env.CURSOR_AGENT = '1'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest', {})
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    const attributes = body[0].metrics[0].attributes
    expect(attributes.invocation_context).toBe('agent')
    expect(attributes.agent_name).toBe('cursor')
    if (orig !== undefined) process.env.CURSOR_AGENT = orig
    else delete process.env.CURSOR_AGENT
  })
})

describe('resolveEventData', () => {
  test('non-postrun with undefined raw yields {}', () => {
    expect(telemetryLib.resolveEventData('command-error', undefined)).toEqual({})
  })
})

describe('formatEventDataAttribute', () => {
  test('string is returned as-is', () => {
    expect(telemetryLib.formatEventDataAttribute('accepted')).toBe('accepted')
    expect(telemetryLib.formatEventDataAttribute('')).toBe('')
  })

  test('object and array use JSON.stringify', () => {
    expect(telemetryLib.formatEventDataAttribute({ a: 1 })).toBe('{"a":1}')
    expect(telemetryLib.formatEventDataAttribute([1, 2])).toBe('[1,2]')
    expect(telemetryLib.formatEventDataAttribute({})).toBe('{}')
  })

  test('number and boolean use String()', () => {
    expect(telemetryLib.formatEventDataAttribute(0)).toBe('0')
    expect(telemetryLib.formatEventDataAttribute(false)).toBe('false')
  })

  test('bigint uses String()', () => {
    expect(telemetryLib.formatEventDataAttribute(42n)).toBe('42')
  })

  test('symbol falls through to String()', () => {
    expect(telemetryLib.formatEventDataAttribute(Symbol('s'))).toBe('Symbol(s)')
  })

  test('undefined yields {}', () => {
    expect(telemetryLib.formatEventDataAttribute(undefined)).toBe('{}')
  })

  test('null yields JSON null token', () => {
    expect(telemetryLib.formatEventDataAttribute(null)).toBe('null')
  })
})

describe('getInvocationContext', () => {
  test('returns human when no agent env vars are set', () => {
    const result = telemetryLib.getInvocationContext({})
    expect(result).toEqual({ isAgent: false, agentName: null })
  })

  test('returns agent cursor when CURSOR_AGENT is set', () => {
    const result = telemetryLib.getInvocationContext({ CURSOR_AGENT: '1' })
    expect(result).toEqual({ isAgent: true, agentName: 'cursor' })
  })

  test('returns agent with name when AGENT is set to a value', () => {
    const result = telemetryLib.getInvocationContext({ AGENT: 'goose' })
    expect(result).toEqual({ isAgent: true, agentName: 'goose' })
  })

  test('returns agent generic when AGENT=1', () => {
    const result = telemetryLib.getInvocationContext({ AGENT: '1' })
    expect(result).toEqual({ isAgent: true, agentName: 'generic' })
  })

  test('returns aio-opt-in when AIO_AGENT is set', () => {
    const result = telemetryLib.getInvocationContext({ AIO_AGENT: '1' })
    expect(result).toEqual({ isAgent: true, agentName: 'aio-opt-in' })
  })

  test('returns aio-opt-in when AIO_INVOCATION_CONTEXT=agent', () => {
    const result = telemetryLib.getInvocationContext({ AIO_INVOCATION_CONTEXT: 'agent' })
    expect(result).toEqual({ isAgent: true, agentName: 'aio-opt-in' })
  })

  test('returns human when AIO_INVOCATION_CONTEXT is not agent', () => {
    const result = telemetryLib.getInvocationContext({ AIO_INVOCATION_CONTEXT: 'human' })
    expect(result).toEqual({ isAgent: false, agentName: null })
  })

  test('returns github-copilot when Copilot Chat PATH markers are present', () => {
    const result = telemetryLib.getInvocationContext({
      PATH: '/usr/local/bin:/Users/test/Library/Application Support/Code/User/globalStorage/github.copilot-chat/debugCommand:/Users/test/Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli'
    })
    expect(result).toEqual({ isAgent: true, agentName: 'github-copilot' })
  })

  test('returns human when PATH does not contain Copilot Chat markers', () => {
    const result = telemetryLib.getInvocationContext({ PATH: '/usr/local/bin:/usr/bin:/bin' })
    expect(result).toEqual({ isAgent: false, agentName: null })
  })

  test('returns human when PATH is null or undefined', () => {
    expect(telemetryLib.getInvocationContext({ PATH: null })).toEqual({ isAgent: false, agentName: null })
    expect(telemetryLib.getInvocationContext({ PATH: undefined })).toEqual({ isAgent: false, agentName: null })
  })

  test('AGENT takes precedence over tool-specific when both set', () => {
    const result = telemetryLib.getInvocationContext({ AGENT: 'goose', CURSOR_AGENT: '1' })
    expect(result).toEqual({ isAgent: true, agentName: 'goose' })
  })

  test('ignores empty string env values', () => {
    const result = telemetryLib.getInvocationContext({ CURSOR_AGENT: '' })
    expect(result).toEqual({ isAgent: false, agentName: null })
  })

  test('returns agent generic when AGENT=true', () => {
    const result = telemetryLib.getInvocationContext({ AGENT: 'true' })
    expect(result).toEqual({ isAgent: true, agentName: 'generic' })
  })

  test('returns aio-opt-in when AI_AGENT is set', () => {
    const result = telemetryLib.getInvocationContext({ AI_AGENT: 'my-agent' })
    expect(result).toEqual({ isAgent: true, agentName: 'my-agent' })
  })

  test('returns generic when AI_AGENT=1', () => {
    const result = telemetryLib.getInvocationContext({ AI_AGENT: '1' })
    expect(result).toEqual({ isAgent: true, agentName: 'generic' })
  })

  test('returns claude when CLAUDECODE is set', () => {
    expect(telemetryLib.getInvocationContext({ CLAUDECODE: '1' })).toEqual({ isAgent: true, agentName: 'claude' })
  })

  test('returns claude when CLAUDE_CODE is set', () => {
    expect(telemetryLib.getInvocationContext({ CLAUDE_CODE: '1' })).toEqual({ isAgent: true, agentName: 'claude' })
  })

  test('returns gemini when GEMINI_CLI is set', () => {
    expect(telemetryLib.getInvocationContext({ GEMINI_CLI: '1' })).toEqual({ isAgent: true, agentName: 'gemini' })
  })

  test('returns codex when CODEX_SANDBOX is set', () => {
    expect(telemetryLib.getInvocationContext({ CODEX_SANDBOX: '1' })).toEqual({ isAgent: true, agentName: 'codex' })
  })

  test('returns augment when AUGMENT_AGENT is set', () => {
    expect(telemetryLib.getInvocationContext({ AUGMENT_AGENT: '1' })).toEqual({ isAgent: true, agentName: 'augment' })
  })

  test('returns cline when CLINE_ACTIVE is set', () => {
    expect(telemetryLib.getInvocationContext({ CLINE_ACTIVE: '1' })).toEqual({ isAgent: true, agentName: 'cline' })
  })

  test('returns opencode when OPENCODE_CLIENT is set', () => {
    expect(telemetryLib.getInvocationContext({ OPENCODE_CLIENT: '1' })).toEqual({ isAgent: true, agentName: 'opencode' })
  })

  test('returns replit when REPL_ID is set', () => {
    expect(telemetryLib.getInvocationContext({ REPL_ID: 'abc123' })).toEqual({ isAgent: true, agentName: 'replit' })
  })
})

describe('AIO_TELEMETRY_DISABLED', () => {
  let orig

  beforeEach(() => {
    orig = process.env.AIO_TELEMETRY_DISABLED
    process.env.AIO_TELEMETRY_DISABLED = '1'
    telemetryLib.init('a@4', 'binTest', {})
  })

  afterEach(() => {
    if (orig !== undefined) process.env.AIO_TELEMETRY_DISABLED = orig
    else delete process.env.AIO_TELEMETRY_DISABLED
  })

  test('isEnabled returns false when AIO_TELEMETRY_DISABLED is set', () => {
    // config.get would return false (opted in), but the env var should override
    const config = require('@adobe/aio-lib-core-config')
    config.get.mockReturnValue(false)
    expect(telemetryLib.isEnabled()).toBe(false)
  })

  test('isNull returns false when AIO_TELEMETRY_DISABLED is set', () => {
    const config = require('@adobe/aio-lib-core-config')
    config.get.mockReturnValue(undefined)
    expect(telemetryLib.isNull()).toBe(false)
  })
})
