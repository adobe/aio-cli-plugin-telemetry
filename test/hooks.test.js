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
const config = require('@adobe/aio-lib-core-config')

jest.mock('@adobe/aio-lib-core-config')
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({ unref: jest.fn() }))
}))

const fetch = createFetch()
const { spawn } = require('child_process')
const telemetryLib = require('../src/telemetry-lib')

const mockPackageJson = {
  bin: { aio: '' },
  name: 'name',
  aioTelemetry: {}
}

describe('hook interfaces', () => {
  let noticeSpy
  beforeEach(() => {
    fetch.mockReset()
    spawn.mockClear()
    config.get.mockReset()
    config.set.mockClear()
    noticeSpy = jest.spyOn(telemetryLib, 'notice')
  })
  afterEach(() => {
    noticeSpy.mockRestore()
  })

  test('command-error', async () => {
    config.get.mockImplementation((key) => (String(key).includes('optOut') ? false : 'clientid'))
    telemetryLib.init('name@0.0.1', 'aio', mockPackageJson.aioTelemetry)
    const hook = require('../src/hooks/command-error')
    expect(typeof hook).toBe('function')
    await hook({ message: 'msg' })
    expect(spawn).not.toHaveBeenCalled()
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalledTimes(1)
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    const body = JSON.parse(flushPayload.body)
    expect(body[0].metrics.map((m) => m.attributes.eventType)).toEqual(['command-error', 'postrun'])
  })

  test('command-not-found', async () => {
    config.get.mockImplementation((key) => (String(key).includes('optOut') ? false : 'clientid'))
    telemetryLib.init('name@0.0.1', 'aio', mockPackageJson.aioTelemetry)
    const hook = require('../src/hooks/command-not-found')
    expect(typeof hook).toBe('function')
    await hook({ id: 'id' })
    expect(spawn).not.toHaveBeenCalled()
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalledTimes(1)
    const flushPayloadNf = JSON.parse(spawn.mock.calls[0][1][1])
    const bodyNf = JSON.parse(flushPayloadNf.body)
    expect(bodyNf[0].metrics.map((m) => m.attributes.eventType)).toEqual(['command-not-found', 'postrun'])
  })

  test('init shows one-time notice on first run', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ config: { name: 'name', version: '0.0.1', pjson: mockPackageJson }, argv: [] })
    expect(noticeSpy).toHaveBeenCalled()
    expect(config.set).toHaveBeenCalledWith('aio-cli-telemetry.optOut', false)
    expect(spawn).not.toHaveBeenCalled()
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalledTimes(1)
    const flushPayloadAcc = JSON.parse(spawn.mock.calls[0][1][1])
    const bodyAcc = JSON.parse(flushPayloadAcc.body)
    expect(bodyAcc[0].metrics.map((m) => m.attributes.eventType)).toEqual(['telemetry-notice', 'postrun'])
    expect(bodyAcc[0].metrics[0].attributes.eventData).toBe('shown')
    process.env = preEnv
  })

  test('init - no notice for telemetry commands', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ id: 'telemetry', config: { name: 'name', version: '0.0.1' }, argv: [] })
    expect(noticeSpy).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    process.env = preEnv
  })

  test('init - no notice when oclif is generating readme', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ id: 'readme', config: { name: 'name', version: '0.0.1' }, argv: [] })
    expect(noticeSpy).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    process.env = preEnv
  })

  test('init - no notice when process.env.CI', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: 'true' }
    let hook
    jest.isolateModules(() => {
      hook = require('../src/hooks/init')
    })
    expect(typeof hook).toBe('function')
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ config: { name: 'name', version: '0.0.1' }, argv: ['--verbose'] })
    expect(noticeSpy).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    process.env = preEnv
  })

  /**
   * When the user has already chosen a state (optOut defined), isNull() is false,
   * so the notice is not shown again.
   */
  test('init - no notice when telemetry state already set', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    config.get = jest.fn().mockReturnValue(false) // optOut already set -> isNull() false
    await hook({ config: { name: 'name', version: '0.0.1', pjson: mockPackageJson }, argv: [] })
    expect(noticeSpy).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    process.env = preEnv
  })

  test('telemetry', async () => {
    telemetryLib.init('name@0.0.1', 'aio', mockPackageJson.aioTelemetry)
    const hook = require('../src/hooks/telemetry')
    expect(typeof hook).toBe('function')
    config.get = jest
      .fn()
      .mockReturnValueOnce('clientid')
      .mockReturnValueOnce(false)

    await hook({ data: { feature: 'x' } })
    expect(spawn).not.toHaveBeenCalled()
    await telemetryLib.trackEvent('postrun')
    expect(spawn).toHaveBeenCalledTimes(1)
    const flushPayloadCe = JSON.parse(spawn.mock.calls[0][1][1])
    const bodyCe = JSON.parse(flushPayloadCe.body)
    expect(bodyCe[0].metrics.map((m) => m.attributes.eventType)).toEqual(['telemetry-custom-event', 'postrun'])
  })

  test('postrun', async () => {
    config.get.mockImplementation((key) => (String(key).includes('optOut') ? false : 'clientid'))
    telemetryLib.init('name@0.0.1', 'aio', mockPackageJson.aioTelemetry)
    const hook = require('../src/hooks/postrun')
    expect(typeof hook).toBe('function')
    await hook({ Command: { id: 'id' }, argv: ['--hello'] })
    expect(spawn).toHaveBeenCalledTimes(1)
    const flushPayload = JSON.parse(spawn.mock.calls[0][1][1])
    expect(flushPayload.headers).toBeUndefined()
    expect(flushPayload.body).toContain('"eventType":"postrun"')
  })

  /**
   * Should NOT prompt even though config.get(optOut) returned undefined
   * --no-telemetry flag wins
   */
  test('init --no-telemetry no notice', async () => {
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ config: { name: 'name', version: '0.0.1' }, argv: ['--no-telemetry'] })
    expect(noticeSpy).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
  })

  test('prerun', async () => {
    const hook = require('../src/hooks/prerun')
    expect(typeof hook).toBe('function')
    await hook({ Command: { id: 'id' }, argv: ['--hello'] })
    expect(spawn).not.toHaveBeenCalled()
    await hook({ Command: { id: 'id' }, argv: ['--hello', '--no-telemetry'] })
    expect(spawn).not.toHaveBeenCalled()
  })

  test('prerun disables telemetry for postrun', async () => {
    const preHook = require('../src/hooks/prerun')
    const postHook = require('../src/hooks/postrun')
    config.get.mockResolvedValue('clientidxyz')
    await preHook({ Command: { id: 'id' }, argv: ['--hello', '--no-telemetry'] })
    await postHook({ Command: { id: 'id' }, argv: ['--hello', '--no-telemetry'] })
    expect(spawn).not.toHaveBeenCalled()
  })
})
