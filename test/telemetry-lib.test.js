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

const fetch = require('node-fetch')
const telemetryLib = require('../src/telemetry-lib')
const config = require('@adobe/aio-lib-core-config')

jest.mock('@adobe/aio-lib-core-config')

describe('telemetry-lib', () => {
  beforeEach(() => {
    jest.resetModules()
    fetch.mockReset()
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
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"clientId":"clientidxyz"') }))
  })
})
