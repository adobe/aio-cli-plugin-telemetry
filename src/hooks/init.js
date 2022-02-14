
const telemetryLib = require('../telemetry-lib')

module.exports = async function (opts) {
  // console.log('userAgent = ', opts.config.userAgent)
  global.commandHookStartTime = Date.now()
  // init event is currently disabled as it is similar to prerun
  return new Promise(resolve => {
    if (telemetryLib.isNull()) {
      // let's ask!
      telemetryLib.prompt(resolve)
    } else {
      resolve()
    }
  })
}
