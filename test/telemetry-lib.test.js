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

jest.mock('@adobe/aio-lib-core-config')
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({ unref: jest.fn() }))
}))

const fetch = createFetch()
const { spawn } = require('child_process')

describe('telemetry-lib', () => {
  beforeEach(() => {
    jest.resetModules()
    fetch.mockReset()
    spawn.mockClear()
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
    telemetryLib.init('a@4', 'binTest')
    telemetryLib.enable()
    expect(config.set).toHaveBeenCalledWith('binTest-cli-telemetry.optOut', false)
    telemetryLib.disable()
    expect(config.set).toHaveBeenCalledWith('binTest-cli-telemetry.optOut', true)
  })

  test('uses client id from config', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest2')
    await telemetryLib.trackEvent('test-event')
    expect(config.get).toHaveBeenCalledWith('binTest2-cli-telemetry.clientId')
    expect(config.get).toHaveBeenCalledWith('binTest2-cli-telemetry.optOut', 'global')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    expect(flushPayload.body).toContain('"clientId":"clientidxyz"')
  })

  test('trackEvent includes invocation_context and agent_name in payload', async () => {
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest')
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalled()
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    const attributes = body[0].metrics[0].attributes
    expect(attributes).toHaveProperty('invocation_context')
    expect(attributes).toHaveProperty('agent_name')
    expect(['agent', 'human']).toContain(attributes.invocation_context)
  })

  test('trackEvent does not post when AIO_TELEMETRY_DISABLED is set', async () => {
    const orig = process.env.AIO_TELEMETRY_DISABLED
    process.env.AIO_TELEMETRY_DISABLED = '1'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest')
    await telemetryLib.trackEvent('postrun')
    expect(spawn).not.toHaveBeenCalled()
    if (orig !== undefined) process.env.AIO_TELEMETRY_DISABLED = orig
    else delete process.env.AIO_TELEMETRY_DISABLED
  })

  test('trackEvent sends agent context when CURSOR_AGENT env is set', async () => {
    const orig = process.env.CURSOR_AGENT
    process.env.CURSOR_AGENT = '1'
    config.get.mockReturnValue('clientidxyz')
    telemetryLib.init('a@4', 'binTest')
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

  test('AGENT takes precedence over tool-specific when both set', () => {
    const result = telemetryLib.getInvocationContext({ AGENT: 'goose', CURSOR_AGENT: '1' })
    expect(result).toEqual({ isAgent: true, agentName: 'goose' })
  })

  test('ignores empty string env values', () => {
    const result = telemetryLib.getInvocationContext({ CURSOR_AGENT: '' })
    expect(result).toEqual({ isAgent: false, agentName: null })
  })
})

describe('AIO_TELEMETRY_DISABLED', () => {
  let orig

  beforeEach(() => {
    orig = process.env.AIO_TELEMETRY_DISABLED
    process.env.AIO_TELEMETRY_DISABLED = '1'
    telemetryLib.init('a@4', 'binTest')
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
