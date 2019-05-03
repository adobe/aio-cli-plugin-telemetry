
const telemetryLib = require('../telemetry-lib')

module.exports = async function (opts) {
  if (telemetryLib.isEnabled()) {
    telemetryLib.trackEvent('prerun',
      opts.Command.id,
      opts.argv.filter(arg => arg.indexOf('-') === 0).join(','))
  }
}
