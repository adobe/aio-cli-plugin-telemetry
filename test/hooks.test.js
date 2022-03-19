/*
 * Copyright 2022 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const fetch = require('node-fetch')
const inquirer = require('inquirer')
const config = require('@adobe/aio-lib-core-config')
const { stdout } = require('stdout-stderr')
const { string } = require('@oclif/command/lib/flags')



describe('hook interfaces', () => {

    beforeEach(() => {
        fetch.mockReset()
    })

    test('command-error', async () => {
        const hook = require('../src/hooks/command-error')
        expect(typeof hook).toBe('function')
        let res = await hook({message:'msg'})
        expect(fetch).toHaveBeenCalledWith(expect.any(String),
          expect.objectContaining({ body: expect.stringContaining('\"_adobeio\":{\"eventType\":\"command-error\"')}))
    })

    test('command-not-found', async () => {
        const hook = require('../src/hooks/command-not-found')
        expect(typeof hook).toBe('function')
        let res = await hook({id:'id'})
        expect(fetch).toHaveBeenCalledWith(expect.any(String),
          expect.objectContaining({ body: expect.stringContaining('\"_adobeio\":{\"eventType\":\"command-not-found\"')}))
    })

    test('init', async () => {
        const hook = require('../src/hooks/init')
        expect(typeof hook).toBe('function')
        inquirer.prompt = jest.fn().mockResolvedValue({ accept:false })
        let res = await hook({config:{ name: 'name', version: '0.0.1'}, argv:['--no-telemetry']})
        expect(fetch).toHaveBeenCalledWith(expect.any(String),
          expect.objectContaining({ body: expect.stringContaining('\"_adobeio\":{\"eventType\":\"telemetry-prompt\",\"eventData\":\"declined\"')}))
    })

    test('postrun', async () => {
        const hook = require('../src/hooks/postrun')
        expect(typeof hook).toBe('function')
        let res = await hook({Command:{id:'id'}, argv:['--hello']})
        expect(fetch).toHaveBeenCalledWith(expect.any(String),
          expect.objectContaining({ body: expect.stringContaining('\"_adobeio\":{\"eventType\":\"postrun\"')}))
    })

    test('prerun', async () => {
        const hook = require('../src/hooks/prerun')
        expect(typeof hook).toBe('function')
        let res = await hook({Command:{id:'id'}, argv:['--hello']})
        expect(fetch).not.toHaveBeenCalled()
        res = await hook({Command:{id:'id'}, argv:['--hello', '--no-telemetry']})
        expect(fetch).not.toHaveBeenCalled()
    }) 

    test('telemetry', async () => {
        const hook = require('../src/hooks/telemetry')
        expect(typeof hook).toBe('function')
        let res = await hook({message:'msg'})
        expect(fetch).toHaveBeenCalledWith(expect.any(String),
          expect.objectContaining({ body: expect.stringContaining('\"_adobeio\":{\"eventType\":\"telemetry\"')}))
    })
})