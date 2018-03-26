
const CDP = require('chrome-remote-interface');
const { spawn } = require('child_process');
const winston = require('winston');
const constants = require('./constants');

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ],
    exitOnError: false
});



module.exports = class ChromeManager {
    constructor(url, onActive) {
        let options = { port: 8282 },
            closed = false;
        spawnChrome(options.port, url)
            .then((chromeInstance) => {
                new CDP(options, async (client) => {
                    const { Page, Network, DOM, Runtime, Input } = client;

                    await DOM.enable();
                    await Network.enable();
                    await Page.enable();
                    await Runtime.enable();
                    // Emulate the selected device by changing user agent
                    await Network.setUserAgentOverride({ userAgent: constants.userAgent });
                    await Network.setCacheDisabled({ cacheDisabled: true });
                    await Page.navigate({ url });

                    this.page = Page;
                    this.dom = DOM;
                    this.network = Network;
                    this.runtime = Runtime;
                    this.client = client;
                    this.input = Input;

                    onActive(this);
                })
            });
    }

    async evaluate(js) {
        return await this.runtime.evaluate({ expression: js });
    }

    async getNodeByXPath(xpath) {
        let { searchId, resultCount } = await this.dom.performSearch({ query: xpath });
        console.log(resultCount);
        return await this.dom.getSearchResults({ searchId, fromIndex: 0, toIndex: resultCount - 1 })[0];
    }

    async inputString(input) {
        input.split('').forEach(async char => {
            await this.input.dispatchKeyEvent({ type: "char", text: char, unmodifiedText: char });
        });
    }

    async sendKey(keyCode) {
        await this.input.dispatchKeyEvent({ type: 'rawKeyDown',windowsVirtualKeyCode: keyCode  });
    }
}


function spawnChrome(port) {
    return new Promise((resolve, reject) => {
        const child = spawn(constants.CHROME_EXEC, [
            '--headless',
            '--disable-gpu',
            '--hide-scrollbars',
            '--incognito',
            `--remote-debugging-port=${port}`
        ]);
        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        child.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
        });

        child.on('error', (err) => {
            console.log('Failed to start Chrome');
        });

        child.on('close', (code) => {
            console.log(`Chrome exited with code ${code}`);
        });
        setTimeout(() => {
            resolve(child);
        }, 1000);
    })
};