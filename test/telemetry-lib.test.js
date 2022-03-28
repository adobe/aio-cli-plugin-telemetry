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
    expect(telemetryLib.Messages).toBeDefined()
  })

  test('uses client id from config', async () => {
    config.get.mockReturnValue('clientidxyz')
    await telemetryLib.trackEvent('test-event')
    expect(config.get).toHaveBeenCalledWith('aio-cli-telemetry.clientId')
    expect(config.get).toHaveBeenCalledWith('aio-cli-telemetry.optOut', 'global')
    expect(fetch).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"clientId":"clientidxyz"') }))
  })
})
