/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { Command, flags } = require('@oclif/command')
const telemetryLib = require('../../telemetry-lib')

class IndexCommand extends Command {
  async run () {
    const { args, flags } = this.parse(IndexCommand)
    if (flags.reset) {
      telemetryLib.reset()
      this.log('resetting telemetry')
    } else {
      switch (args.state) {
        case 'on':
        case 'yes': { // fallthrough
          telemetryLib.enable()
          this.log(telemetryLib.Messages.TelemetryOnMessage)
          break
        }
        case 'off':
        case 'no': { // fallthrough
          telemetryLib.disable()
          this.log(telemetryLib.Messages.TelemetryOffMessage)
          break
        }
        default:
          if (telemetryLib.isEnabled()) {
            this.log(telemetryLib.Messages.TelemetryOnMessage)
          } else {
            this.log(telemetryLib.Messages.TelemetryOffMessage)
          }
          break
      }
    }
  }
}

IndexCommand.description = `Help us improve the Adobe Developer CLI
Allow the Adobe Developer CLI to collect anonymous usage data
`

IndexCommand.usage = [
  'telemetry yes',
  'telemetry off',
  'telemetry']

IndexCommand.flags = {
  reset: flags.boolean({
    hidden: true
  })
}

IndexCommand.args = [{
  name: 'state',
  required: false,
  description: 'set telemetry state',
  options: ['on', 'off', 'yes', 'no']
}]

module.exports = IndexCommand
