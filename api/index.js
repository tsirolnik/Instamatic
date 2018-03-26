
const CDP = require('chrome-remote-interface');
const winston = require('winston');
const ChromeManager = require('./chrome');
const constants = require('./constants');
const loginFunctions = require('./login');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ],
    exitOnError: false
});

module.exports = class InstaMatic {

    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.wasLoaded = false;
    }

    async start(onReady) {
        let chromeManager = new ChromeManager(constants.INSTAGRAM_URL, async (instance) => {
            logger.info('Started chrome');
            this.instance = instance;
            instance.page.loadEventFired(async () => {
                if(this.wasLoaded) return;
                this.wasLoaded = true;
                logger.info('Load event fired');
                await this.timeout(3000);
                onReady(this);
            });
        });
    }


    async login() {
        console.log('login');
        let isLoggedIn = await loginFunctions.isLoggedIn(this.username, this.instance);
        if (isLoggedIn) {
            return true;
        }
        await loginFunctions.clickLogin(this.instance);
        await loginFunctions.setLoginDetailsOnLogin(this.username, this.password, this.instance);
        await loginFunctions.submitLogin(this.instance);
        await this.timeout(3000);
        if (await loginFunctions.isLoggedIn(this.username, this.instance)) {
            logger.info('Logged in successfuly');
            return true;
        } else {
            logger.info('Could not log in');
            let hasSuspiciousAttempt = await loginFunctions.hasSuspiciousLoginAttempt(this.instance);
            if (hasSuspiciousAttempt) {
                logger.info('Suspicious behavior detected. Sending code to email');
                await loginFunctions.submitSuspiciousAttempt(this.instance);
                let isWaitingForCode = await loginFunctions.isWaitingForCode(this.instance);
                if (isWaitingForCode) {
                    logger.info('pre-input');
                    let code = await this.userInput('Insert Instagram code:');
                    logger.info('post-input');
                    await loginFunctions.inputCode(code, this.instance);
                    await this.timeout(1500);
                    await loginFunctions.validateSecurityCode(this.instance);
                    return true;
                }
            } else {
                logger.info('Could not find suspicious login form');
            }
            return false;
        }

    }

    userInput(inputLine) {
        return new Promise((resolve, reject) => {
            rl.question(inputLine, (input) => {
                rl.close();
                resolve(input);
            });
        })
    }

    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async search(searchTerm) {
        const focusSearch = `document.querySelector('input[placeholder="Search"]').focus();`
        let { result } = await this.instance.evaluate(focusSearch);
        await this.instance.inputString(searchTerm + "\n");
    }


}