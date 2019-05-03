
const telemetryLib = require('../telemetry-lib')

module.exports = async function (opts) {
  // init event is currently disabled as it is similar to prerun
  return new Promise((resolve, reject) => {
    if (telemetryLib.isNull()) {
      // let's ask!
      telemetryLib.prompt(resolve)
    }
    else {
      resolve()
    }
  })
}
