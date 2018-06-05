
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


    async goTo(url) {
        await this.page.navigate({ url });
    }

    async goBack() {
        await this.runtime.evaluate({ expression: 'history.back();' });
    }

    async evaluate(js) {
        return await this.runtime.evaluate({ expression: js });
    }

    async getNodesByXPath(xpath) {
        await this.dom.getDocument();
        let { searchId, resultCount } = await this.dom.performSearch({ query: xpath });
        if (resultCount < 1) return [];
        let { nodeIds } = await this.dom.getSearchResults({
            searchId,
            fromIndex: 0,
            toIndex: resultCount
        });
        let nodes = [];
        for (let i = 0; i < nodeIds.length; i++) {
            let nodeData = { attributes: {}, value: '' };
            let nodeId = nodeIds[i];
            let { node } = await this.dom.describeNode({ nodeId });
            if (node.attributes) {
                let attributes = this.attrArrayToObject(node.attributes);
                nodeData.attributes = attributes;
            }
            nodeData.value = node.nodeValue;
            nodeData.nodeId = nodeId;
            nodes.push(nodeData);
        }
        return nodes;
    }

    attrArrayToObject(arr) {
        let obj = {};
        for (let i = 0; i < arr.length / 2; i += 2) {
            const key = arr[i];
            const val = arr[i + 1];
            obj[key] = val;
        }
        return obj;
    }

    async inputString(input) {
        for (let i = 0; i < input.length; i++) {
            let char = input[i];
            await this.input.dispatchKeyEvent({ type: "char", text: char, unmodifiedText: char });
        }
    }

    async sendKey(keyCode) {
        await this.input.dispatchKeyEvent({ type: 'rawKeyDown', windowsVirtualKeyCode: keyCode });
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
            // Use winston into a file
            //    console.log(`stderr: ${data}`);
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