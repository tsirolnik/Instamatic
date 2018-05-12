
const CDP = require('chrome-remote-interface');
const winston = require('winston');
const readline = require('readline');
const ChromeManager = require('./chrome');
const constants = require('./constants');
const loginFunctions = require('./login');
const user = require('./user');
const SqliteSaver = require('./saver-sqlite');

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
            shouldLike: true,
            shouldComment: true,
            shouldFollow: true,
            followSettings: {
                minimumFollowers: null,
                maximumFollowers: 2500,
                blacklist: []
            }
        };
        this.saver = new SqliteSaver(`instamatic-${username}.db`);
    }

    async start(onReady) {
        let chromeManager = new ChromeManager(constants.INSTAGRAM_URL, async (browser) => {
            logger.info('Started chrome');
            this.browser = browser;
            browser.page.loadEventFired(async () => {
                if (this.wasLoaded) return;
                this.wasLoaded = true;
                logger.info('Load event fired');
                await this.sleep(5000);
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
        await this.sleep(5000);
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
        this.settings.shouldComment = shouldComment;
    }

    setShouldFollow(shouldFollow) {
        this.settings.shouldFollow = shouldFollow;
    }

    setShouldLike(shouldLike) {
        this.settings.shouldLike = shouldLike;
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
        await this.sleep(1000);
        let nodes = await this.browser.getNodesByXPath(`//textarea[@placeholder = "Add a comment…"]`);
        if (nodes.length < 1) {
            logger.error('Failed getting comment input', { nodes });
            return;
        }
        await this.browser.dom.focus({ nodeId: nodes[0].nodeId });
        // Send the text's keys and an enter
        await this.browser.inputString(text + String.fromCharCode(13));
    }

    async follow() {
        let { minimumFollowers, maximumFollowers, blacklist } = this.settings.followSettings;

        let username = await user.getUsername(this.browser);
        logger.info(`Checking ${username}'s profile`);
        if (blacklist.includes(username)) {
            return false;
        }
        logger.info(`User ${username} is not blacklisted`);

        let userFollowersNumber = await user.getFollowersNumber(this.browser);
        if (minimumFollowers && userFollowersNumber < minimumFollowers) {
            return false;
        }
        logger.info(`User has minimum followers of ${minimumFollowers}`);

        if (maximumFollowers && userFollowersNumber > maximumFollowers) {
            return false;
        }
        logger.info(`User has minimum followers of ${maximumFollowers}`);

        await user.follow(this.browser);
        return true;
    }

    async profile_url_from_post() {
        let { result } = await this.browser.evaluate(`document.querySelector('._2g7d5.notranslate._iadoq').href;`);
        if (result.type != 'string') {
            logger.error('Could not find profile link', { result })
            return '';
        }
        let profileLink = result.value;
        return profileLink;
    }

    async interact_with_tags(tags, maxInteractions = 10, onInteracted) {
        for (let tag of tags) {
            logger.info(`Checking tag ${tag}`);
            let posts = await this.getPostsForTag(tag, maxInteractions);
            logger.info(`Found ${posts.length} posts for tag ${tag}`);
            for (let post of posts) {
                logger.info(`Interacting with post ${post}`);
                await this.browser.goTo(post);
                await this.sleep(5000);
                if (this.settings.shouldLike) {
                    logger.info('Should like');
                    await this.saver.getLiked(post).then(async rows => {
                        if (rows.length > 0) {
                            logger.info('Post already liked, passing');
                            return
                        };
                        logger.info('Liking the post');
                        await this.like();
                        this.saver.saveLiked(post);
                        await this.sleep(500);
                    });

                }
                if (this.settings.shouldComment) {
                    logger.info('Should comment');
                    await this.saver.getCommented(post).then(async rows => {
                        if (rows.length > 0) {
                            logger.info('Post already commented, passing');
                            return
                        };
                        logger.info('Commenting on the post');
                        await this.comment(this.getRandomComment());
                        this.saver.saveCommented(post);
                        await this.sleep(2000);
                    })
                }
                if (this.settings.shouldFollow) {
                    logger.info('Should follow');
                    let userProfile = await this.profile_url_from_post();
                    if (userProfile === "") {
                        logger.info('Failed getting user profile link, skipping follow');
                    } else {
                        await this.browser.goTo(userProfile);
                        await this.sleep(2000);
                        let username = await user.getUsername(this.browser);
                        await this.saver.getFollowed(username).then(async rows => {
                            if (rows.length > 0) {
                                logger.info('Already followed user, passing');
                                return
                            };
                            logger.info('Considering to follow user');
                            let didFollow = await this.follow();
                            if (didFollow) {
                                logger.info(`Starting following ${username}`);
                                await this.sleep(1000);
                                this.saver.saveFollowed(username);
                            }
                        });
                        await this.browser.goBack();
                    }
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