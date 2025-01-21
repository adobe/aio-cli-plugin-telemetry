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

const TheCommand = require('../src/commands/telemetry')
const { stdout } = require('stdout-stderr')

jest.mock('inquirer')

let command

beforeEach(() => {
  command = new TheCommand([])
  global.setFetchMock()
})

test('exports a run function', async () => {
  expect(typeof TheCommand.run).toEqual('function')
})

describe('telemetry command', () => {
  test('telemetry yes', async () => {
    command.argv = ['yes']
    await command.run()
    expect(stdout.output).toMatch('Telemetry is on')
  })

  test('telemetry (get) on', async () => {
    command.argv = []
    await command.run()
    expect(stdout.output).toMatch('Telemetry is on')
  })

  test('telemetry no', async () => {
    command.argv = ['no']
    await command.run()
    expect(stdout.output).toMatch('Telemetry is off')
  })

  test('telemetry (get) off', async () => {
    command.argv = []
    await command.run()
    expect(stdout.output).toMatch('Telemetry is off')
  })

  test('telemetry on', async () => {
    command.argv = ['on']
    await command.run()
    expect(stdout.output).toMatch('Telemetry is on')
  })

  test('telemetry off', async () => {
    command.argv = ['off']
    await command.run()
    expect(stdout.output).toMatch('Telemetry is off')
  })

  test('telemetry --reset', async () => {
    command.argv = ['--reset']
    await command.run()
    expect(stdout.output).toMatch('resetting telemetry')
  })
})
