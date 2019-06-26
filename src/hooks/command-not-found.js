
const telemetryLib = require('../telemetry-lib')
const debug = require('debug')('aio-cli-plugin-telemetry')

module.exports = async function (opts) {
  if (telemetryLib.isEnabled()) {
    debug('tracking command-not-found =>', opts.id )
    telemetryLib.trackEvent('command-not-found', opts.id)
  }
}
