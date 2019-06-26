
const telemetryLib = require('../telemetry-lib')
const debug = require('debug')('aio-cli-plugin-telemetry')

module.exports = async function (opts) {
  if(opts.argv.indexOf('--no-telemetry') > -1) {
    debug('--no-telemetry flag found. This command will not be tracked.')
    opts.argv.splice(opts.argv.indexOf('--no-telemetry'),1)
    telemetryLib.disableForCommand()
  }

  if (telemetryLib.isEnabled()) {
    debug('telemetry - prerun hook =>', opts.Command.id)
    telemetryLib.trackEvent('prerun',
      opts.Command.id,
      opts.argv.filter(arg => arg.indexOf('-') === 0).join(','))
  }
}
