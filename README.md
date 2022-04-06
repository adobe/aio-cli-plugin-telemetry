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

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @adobe/aio-cli-plugin-telemetry
$ aio COMMAND
running command...
$ aio (-v|--version|version)
@adobe/aio-cli-plugin-telemetry/0.4.0 darwin-x64 node-v14.19.0
$ aio --help [COMMAND]
USAGE
  $ aio COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`aio telemetry yes`](#aio-telemetry-yes)

## `aio telemetry yes`

Help us improve the Adobe Developer CLI

```
USAGE
  $ aio telemetry yes
  $ aio telemetry off
  $ aio telemetry

ARGUMENTS
  STATE  (on|off|yes|no) set telemetry state

DESCRIPTION
  Allow the Adobe Developer CLI to collect anonymous usage data
```

_See code: [src/commands/telemetry/index.js](https://github.com/adobe/aio-cli-plugin-telemetry/blob/v0.4.0/src/commands/telemetry/index.js)_
<!-- commandsstop -->
