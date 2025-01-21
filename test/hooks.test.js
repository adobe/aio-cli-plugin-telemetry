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

const inquirer = require('inquirer')
const config = require('@adobe/aio-lib-core-config')

jest.mock('inquirer')
jest.mock('@adobe/aio-lib-core-config')

const mockPackageJson = {
  bin: { aio: '' },
  name: 'name',
  aioTelemetry: {
    fetchHeaders: { 'Content-Type': 'application/json' },
    postUrl: 'https://httpstat.us/200'
  }
}

describe('hook interfaces', () => {
  beforeEach(() => {
    global.setFetchMock()
  })

  test('command-error', async () => {
    const hook = require('../src/hooks/command-error')
    expect(typeof hook).toBe('function')
    await hook({ message: 'msg' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"_adobeio":{"eventType":"command-error"') }))
  })

  test('command-not-found', async () => {
    const hook = require('../src/hooks/command-not-found')
    expect(typeof hook).toBe('function')
    await hook({ id: 'id' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"_adobeio":{"eventType":"command-not-found"') }))
  })

  /**
   * Should prompt when config.get(optOut) returns undefined
   * post results
   */
  test('init prompt accept:true', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: true })
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ config: { name: 'name', version: '0.0.1', pjson: mockPackageJson }, argv: [] })
    expect(inquirer.prompt).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"_adobeio":{"eventType":"telemetry-prompt","eventData":"accepted"') }))
    expect(fetch).toHaveBeenCalledTimes(1)
    process.env = preEnv
  })

  test('init prompt - full coverage when run by gh actions', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: true })
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ id: 'telemetry', config: { name: 'name', version: '0.0.1' }, argv: [] })
    expect(inquirer.prompt).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    process.env = preEnv
  })

  test('init prompt - dont ask for telemetry for telemetry commands', async () => {
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: true })
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ id: 'telemetry', config: { name: 'name', version: '0.0.1' }, argv: [] })
    expect(inquirer.prompt).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('init prompt - dont run when oclif is generating readme', async () => {
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: true })
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ id: 'readme', config: { name: 'name', version: '0.0.1' }, argv: [] })
    expect(inquirer.prompt).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('init prompt - dont run when oclif is generating readme and CI is off', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: true })
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ id: 'readme', config: { name: 'name', version: '0.0.1' }, argv: [] })
    expect(inquirer.prompt).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    process.env = preEnv
  })

  test('no prompt when process.env.CI', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: 'true' }
    let hook
    jest.isolateModules(() => {
      hook = require('../src/hooks/init')
    })

    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: false })
    config.get = jest.fn().mockReturnValue(undefined)
    expect(inquirer.prompt).not.toHaveBeenCalled()
    await hook({ config: { name: 'name', version: '0.0.1' }, argv: ['--verbose'] })
    expect(fetch).not.toHaveBeenCalled()
    expect(inquirer.prompt).not.toHaveBeenCalled()
    process.env = preEnv
  })

  /**
   * Should prompt when config.get(optOut) returns undefined
   * should still post after prompt even though it is declined, this is the last post
   */
  test('init prompt accept:false', async () => {
    const preEnv = process.env
    process.env = { ...preEnv, CI: undefined, GITHUB_ACTIONS: undefined }
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn().mockResolvedValue({ accept: false })
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ config: { name: 'name', version: '0.0.1' }, argv: ['--verbose'] })
    expect(inquirer.prompt).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"_adobeio":{"eventType":"telemetry-prompt","eventData":"declined"') }))
    process.env = preEnv
  })

  test('telemetry', async () => {
    const hook = require('../src/hooks/telemetry')
    expect(typeof hook).toBe('function')
    config.get = jest
      .fn()
      .mockReturnValueOnce('clientid')
      .mockReturnValueOnce(false)

    await hook({ message: 'msg' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"_adobeio":{"eventType":"telemetry-custom-event"') }))
  })

  test('postrun', async () => {
    const hook = require('../src/hooks/postrun')
    expect(typeof hook).toBe('function')
    await hook({ Command: { id: 'id' }, argv: ['--hello'] })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"_adobeio":{"eventType":"postrun"') }))
  })

  /**
   * Should NOT prompt even though config.get(optOut) returned undefined
   * --no-telemetry flag wins
   */
  test('init --no-telemetry no prompt', async () => {
    const hook = require('../src/hooks/init')
    expect(typeof hook).toBe('function')
    inquirer.prompt = jest.fn()
    config.get = jest.fn().mockReturnValue(undefined)
    await hook({ config: { name: 'name', version: '0.0.1' }, argv: ['--no-telemetry'] })
    expect(inquirer.prompt).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('prerun', async () => {
    const hook = require('../src/hooks/prerun')
    expect(typeof hook).toBe('function')
    await hook({ Command: { id: 'id' }, argv: ['--hello'] })
    expect(fetch).not.toHaveBeenCalled()
    await hook({ Command: { id: 'id' }, argv: ['--hello', '--no-telemetry'] })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('prerun disables telemetry for postrun', async () => {
    const preHook = require('../src/hooks/prerun')
    const postHook = require('../src/hooks/postrun')
    config.get.mockResolvedValue('clientidxyz')
    await preHook({ Command: { id: 'id' }, argv: ['--hello', '--no-telemetry'] })
    await postHook({ Command: { id: 'id' }, argv: ['--hello', '--no-telemetry'] })
    expect(fetch).not.toHaveBeenCalled()
  })
})
