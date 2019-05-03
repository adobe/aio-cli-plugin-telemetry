
const telemetryLib = require('../telemetry-lib')

module.exports = async function (opts) {
  if (telemetryLib.isEnabled()) {
    telemetryLib.trackEvent('command-not-found', opts.id)
  }
}
