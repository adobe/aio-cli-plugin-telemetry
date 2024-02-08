aio-cli-plugin-telemetry
========================

Adobe Developer cli usage telemetry

[![License](https://img.shields.io/npm/l/@adobe/aio-cli-plugin-telemetry.svg)](https://github.com/adobe/aio-cli-plugin-telemetry/blob/master/package.json)
[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@adobe/aio-cli-plugin-telemetry.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-telemetry)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/aio-cli-plugin-telemetry.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-telemetry)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-cli-plugin-telemetry/master.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-cli-plugin-telemetry/)
[![Github Issues](https://img.shields.io/github/issues/adobe/aio-cli-plugin-telemetry.svg)](https://github.com/adobe/aio-cli-plugin-telemetry/issues)
[![Github Pull Requests](https://img.shields.io/github/issues-pr/adobe/aio-cli-plugin-telemetry.svg)](https://github.com/adobe/aio-cli-plugin-telemetry/pulls) 


# Commands
<!-- commands -->
* [`aio telemetry yes`](#aio-telemetry-yes)

## `aio telemetry yes`

Allow the cli to collect anonymous usage data

```
USAGE
  $ aio telemetry yes
  $ aio telemetry off
  $ aio telemetry

ARGUMENTS
  STATE  (on|off|yes|no) set telemetry state

DESCRIPTION
  Allow the cli to collect anonymous usage data
```

_See code: [src/commands/telemetry/index.js](https://github.com/adobe/aio-cli-plugin-telemetry/blob/v2.0.1/src/commands/telemetry/index.js)_
<!-- commandsstop -->

## Configuration
The following values need to be set when this plugin is hosted by different CLIs
- `aioTelemetry`: defined object in root cli package.json with values:
  - `postUrl` : Where to post telemetry data
  - `postHeaders`: Any specific headers that need to be posted with telemetry data (ex. x-api-key)
  - `productPrivacyPolicyLink`: A link to display to users when prompting to optIn
- `productName`: How to refer to the cli when user is prompted to enable telemetry
  - this value is read from `displayName` or `name` of the cli's package.json
- `productBin`: Output in help text
  - ex. To turn telemetry on run `${productBin} telemetry on`
  - this value is read from 'bin' of the cli's package.json, if the package exports more than 1 bin the first is used

## POST data

Here is an example of the event data as posted:
```
{ "id": 656915165813,
  "timestamp": 1673404918437,
  "_adobeio": {
    "eventType": "telemetry-prompt",
    "eventData": "accepted",
    "cliVersion": "@adobe/aio-cli@9.1.1",
    "clientId": 264421030538,
    "commandDuration": 5661,
    "commandFlags": "",
    "commandSuccess": true,
    "nodeVersion": "v14.20.0",
    "osNameVersion": "macOS"
  }
}
```
