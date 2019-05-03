const {Command, flags} = require('@oclif/command')
const telemetryLib = require('../../telemetry-lib')

class IndexCommand extends Command {
  async run() {
    const {args, flags} = this.parse(IndexCommand)

    if (flags.reset) {
      telemetryLib.reset()
      this.log('resetting telemetry')
    } else {
      switch (args.state) {
      case 'on':
      case 'yes':  {// fallthrough
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

IndexCommand.description = `Describe the command here
...
Extra documentation goes here
`

IndexCommand.flags = {
  reset: flags.boolean({
    hidden: true,
  }),
}

IndexCommand.args = [{
  name: 'state',
  required: false,
  description: 'set telemetry state',
  options: ['on', 'off', 'yes', 'no'],
}]

module.exports = IndexCommand
