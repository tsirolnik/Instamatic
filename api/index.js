
const CDP = require('chrome-remote-interface');
const winston = require('winston');
const ChromeManager = require('./chrome');
const constants = require('./constants');
const loginFunctions = require('./login');
const user = require('./user');
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
        this.wasLoaded = false;
        this.settings = {
            username,
            password,
            shouldLIke: true,
            shouldComment: false,
            shouldFollow: true
        };
    }

    async start(onReady) {
        let chromeManager = new ChromeManager(constants.INSTAGRAM_URL, async (browser) => {
            logger.info('Started chrome');
            this.browser = browser;
            browser.page.loadEventFired(async () => {
                if (this.wasLoaded) return;
                this.wasLoaded = true;
                logger.info('Load event fired');
                await this.sleep(3000);
                onReady(this);
            });
        });
    }


    async login() {
        let isLoggedIn = await loginFunctions.isLoggedIn(this.settings.username, this.browser);
        if (isLoggedIn) {
            return true;
        }
        await loginFunctions.clickLogin(this.browser);
        await loginFunctions.setLoginDetailsOnLogin(this.settings.username, this.settings.password, this.browser);
        await loginFunctions.submitLogin(this.browser);
        await this.sleep(3000);
        if (await loginFunctions.isLoggedIn(this.settings.username, this.browser)) {
            logger.info('Logged in successfuly');
            return true;
        } else {
            logger.info('Could not log in');
            let hasSuspiciousAttempt = await loginFunctions.hasSuspiciousLoginAttempt(this.browser);
            if (hasSuspiciousAttempt) {
                logger.info('Suspicious behavior detected. Sending code to email');
                await loginFunctions.submitSuspiciousAttempt(this.browser);
                let isWaitingForCode = await loginFunctions.isWaitingForCode(this.browser);
                if (isWaitingForCode) {
                    logger.info('pre-input');
                    let code = await this.userInput('Insert Instagram code:');
                    logger.info('post-input');
                    await loginFunctions.inputCode(code, this.browser);
                    await this.sleep(1500);
                    await loginFunctions.validateSecurityCode(this.browser);
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

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getPostsForTag(tag, maxInteractions) {
        await this.browser.goTo(constants.INSTAGRAM_URL + '/explore/tags/' + tag)
        await this.sleep(2000);
        for (let i = 0; i < maxInteractions / 10; i++) {
            const { result } = await this.browser.evaluate(`window.scrollTo(0, document.body.scrollHeight);`);
            await this.sleep(500);
        }
        await this.sleep(3000);
        let nodes = await this.browser.getNodesByXPath('//main/article/div[2]/div/div/div/a');
        let photos = [];
        for (let node of nodes) {
            // Push the href's value
            photos.push(constants.INSTAGRAM_URL + node.attributes.href);
        }
        return photos;
    }

    setComments(comments) {
        // Must pass an array
        if (!Array.isArray(comments)) {
            throw new Error('Must pass an array to setComments');
        }
        this.comments = comments;
    }

    setFollowSettings(settings) {
        this.settings.followSettings = settings;
    }

    setShouldComment(shouldComment) {
        this.settings.shouldComment = true;
    }

    getRandomComment() {
        if (!this.comments) return;
        let randomPosition = Math.floor(Math.random() * this.comments.length);
        return this.comments[randomPosition];
    }

    async like() {
        await this.browser.evaluate(`document.querySelector('._eszkz._l9yih').click();`);
    }

    async comment(text) {
        /**
         * Consider switching to use the .value attribute with added space
         * Then sending a backspace + enter
         * This will allow stuff like Emoji and etc
         */
        await this.browser.evaluate(`document.querySelector('._p6oxf._6p9ga').click();`);
        let nodes = await this.browser.getNodesByXPath(`//textarea[@placeholder = "Add a comment…"]`);
        await this.browser.dom.focus({ nodeId: nodes[0].nodeId });
        // Send the text's keys and an enter
        await this.browser.inputString(text + String.fromCharCode(13));
    }

    async follow() {
        let number = await user.getFollowersNumber(this.browser);
        console.log(number);

        let userName = await user.getUsername(this.browser);
        console.log(userName);
       
        await user.follow(this.browser);
    }

    async profile_url_from_post() {
        let { result } = await this.browser.evaluate(`document.querySelector('._2g7d5.notranslate._iadoq').href;`);
        if (result.type != 'string') {
            throw new Error('Couldn\'t find profile link');
        }
        let profileLink = result.value;
        return profileLink;
    }

    async interact_with_tags(tags, maxInteractions = 10, onInteracted) {
        for (let tag of tags) {
            let posts = await this.getPostsForTag(tag, maxInteractions);
            for (let post of posts) {
                await this.browser.goTo(post);
                await this.sleep(2000);
                if (this.settings.shouldLike) {
                    await this.like();
                    await this.sleep(500);
                }
                if (this.settings.shouldComment) {
                    await this.comment(this.getRandomComment());
                    await this.sleep(500);
                }
                if (this.settings.shouldFollow) {
                    let userProfile = await this.profile_url_from_post();
                    await this.browser.goTo(userProfile);
                    await this.sleep(2000);
                    await this.follow();
                    await this.browser.goBack();
                }
                if (onInteracted) {
                    onInteracted();
                }
                await this.browser.goBack();
                await this.sleep(2000);
            }
        }
    }


}