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

const { Command, Flags } = require('@oclif/core')
const telemetryLib = require('../../telemetry-lib')

class IndexCommand extends Command {
  async run () {
    // get the product name from the package.json with fallbacks
    const pjson = this.config?.pjson || { name: 'Adobe Developer CLI', bin: { aio: '' } }
    // product name is either the displayName or the name
    const productName = pjson.displayName || pjson.name
    // we use the first bin name as the default
    const [binName] = Object.keys(pjson.bin)
    const { args, flags } = await this.parse(IndexCommand)
    if (flags.reset) {
      telemetryLib.reset()
      this.log('resetting telemetry')
    } else {
      switch (args.state) {
        case 'on':
        case 'yes': { // fallthrough
          telemetryLib.enable()
          this.log(telemetryLib.getOnMessage(productName, binName))
          break
        }
        case 'off':
        case 'no': { // fallthrough
          telemetryLib.disable()
          this.log(telemetryLib.getOffMessage(binName))
          break
        }
        default:
          if (telemetryLib.isEnabled()) {
            this.log(telemetryLib.getOnMessage(productName, binName))
          } else {
            this.log(telemetryLib.getOffMessage(binName))
          }
          break
      }
    }
  }
}

IndexCommand.description = `Allow the cli to collect anonymous usage data`

IndexCommand.usage = [
  'telemetry yes',
  'telemetry off',
  'telemetry']

IndexCommand.flags = {
  reset: Flags.boolean({
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
