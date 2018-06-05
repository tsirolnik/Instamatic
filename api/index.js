
const CDP = require('chrome-remote-interface');
const winston = require('winston');
const readline = require('readline');
const ChromeManager = require('./chrome');
const constants = require('./constants');
const loginFunctions = require('./login');
const userPage = require('./user');
const postPage = require('./post');
const SqliteSaver = require('./saver-sqlite');
const utils = require('./utils');

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
                maximumFollowers: 1500,
                maxToFollow: 200,
                followPercentage: 30,
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
                await utils.sleep(5000);
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
        await utils.sleep(2000);
        await loginFunctions.setLoginDetailsOnLogin(this.settings.username, this.settings.password, this.browser);
        await loginFunctions.submitLogin(this.browser);
        await utils.sleep(5000);
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
                    await utils.sleep(1500);
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

    async getPostsForTag(tag, maxInteractions) {
        await this.browser.goTo(constants.INSTAGRAM_URL + '/explore/tags/' + tag)
        await utils.sleep(2000);
        for (let i = 0; i < maxInteractions / 10; i++) {
            const { result } = await this.browser.evaluate(`window.scrollTo(0, document.body.scrollHeight);`);
            await utils.sleep(500);
        }
        await utils.sleep(3000);
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
        await this.browser.evaluate(`document.evaluate('//span[contains(child::text(), \"Like\")]', document, null, XPathResult.ANY_TYPE, null).iterateNext().click();`);
    }

    async comment(text) {
        /**
         * Consider switching to use the .value attribute with added space
         * Then sending a backspace + enter
         * This will allow stuff like Emoji and etc
         */
        await this.browser.evaluate(`document.querySelector('._p6oxf._6p9ga').click();`);
        await utils.sleep(1000);
        let nodes = await this.browser.getNodesByXPath(`//textarea[@placeholder = "Add a comment…"]`);
        if (nodes.length < 1) {
            logger.error('Failed getting comment input', { nodes });
            return;
        }
        await this.browser.dom.focus({ nodeId: nodes[0].nodeId });
        // Send the text's keys and an enter
        await this.browser.inputString(text + String.fromCharCode(13));
    }

    async follow(username, userProfile) {
        let { minimumFollowers, maximumFollowers, blacklist, maxToFollow, followPercentage } = this.settings.followSettings;
        logger.info(`Checking ${username}'s profile`);

        await this.browser.goTo(userProfile);
        await utils.sleep(2000);


        let rows = await this.saver.getFollowed(username)
        if (rows.length > 0) {
            return { didFollow: false, err: 'Already followed user' };
        }

        let userFollowersNumber = await userPage.getFollowersCount(this.browser);
        logger.info(`User ${username} has ${userFollowersNumber} followers`);

        if (!utils.checkChance(followPercentage)) {
            logger.info('Not following the user as per followPercentage', { followPercentage });
            return { didFollow: false, err: 'Follow chance denied' };
        }

        if (blacklist.includes(username)) {
            return { didFollow: false, err: 'blacklisted' };
        }
        logger.info(`User ${username} is not blacklisted`);

        if (minimumFollowers && userFollowersNumber < minimumFollowers) {
            return { didFollow: false, err: 'Not minimal follow count' };
        }
        logger.info(`User is above minimum followers of ${minimumFollowers}`);

        if (maximumFollowers && userFollowersNumber > maximumFollowers) {
            return { didFollow: false, err: 'Above maxmimal follow count' };
        }
        logger.info(`User is below maximum followers of ${maximumFollowers}`);

        await userPage.follow(this.browser);
        await utils.sleep(1000);
        return { didFollow: true, err: undefined };
    }

    async unfollowSince(hour) {
        let followed = await this.saver.getAllFollowed({
            timestamp: Date.now() - 1000 * 60 * 60 * hour,
            operator: '<'
        });

        logger.info(`Trying to unfollowed ${followed.length} accounts`);
        for (let i = 0; i < followed.length; i++) {
            let followInfo = followed[i];
            let username = followInfo.identifier;
            logger.info(`Unfollowing ${username}`);
            await this.browser.goTo('https://instagram.com/' + username);
            await utils.sleep(3000);
            await userPage.unfollow(this.browser);
            logger.info(`Unfollowed ${username}`);
            this.saver.removeFollow(username);
            logger.info(`Removed ${username} from database`);
            await utils.sleep(utils.randRange(2000, 5000));
        };
    }

    async interact_with_tags(tags, maxInteractions = 10, onInteracted) {
        for (let tag of tags) {
            logger.info(`Checking tag ${tag}`);
            let posts = await this.getPostsForTag(tag, maxInteractions);
            logger.info(`Found ${posts.length} posts for tag ${tag}`);
            for (let post of posts) {
                logger.info(`Interacting with post ${post}`);
                await this.browser.goTo(post);
                await utils.sleep(3000);
                await utils.sleep(utils.randRange(2000, 7000));
                if (this.settings.shouldLike) {
                    logger.info(`Like process on ${post}`);
                    let rows = await this.saver.getLiked(post)
                    if (rows.length > 0) {
                        logger.info('Post already liked, passing');
                    } else {
                        logger.info('Liking the post');
                        await this.like();
                        this.saver.saveLiked(post);
                        await utils.sleep(500);
                    }
                }
                if (this.settings.shouldComment) {
                    logger.info(`Comment process on ${post}`);
                    let rows = await this.saver.getCommented(post)
                    if (rows.length > 0) {
                        logger.info('Post already commented, passing');
                    } else {
                        logger.info('Commenting on the post');
                        await this.comment(this.getRandomComment());
                        this.saver.saveCommented(post);
                        await utils.sleep(2000);
                    }
                }
                if (this.settings.shouldFollow) {
                    logger.info(`Follow process on ${post}`);
                    let totalFollowed = await this.saver.totalFollowed();
                    logger.info(`Total followed by now ${totalFollowed}`);
                    if (totalFollowed > this.settings.followSettings.maxToFollow) {
                        logger.info('Skipping follow, maximum followed');
                    } else {
                        let userProfile = await postPage.userProfile(this.browser, logger);
                        if (userProfile === '') {
                            logger.info('Failed getting user profile link, skipping follow');
                        } else {
                            let username = await postPage.username(this.browser);
                            let { didFollow, err } = await this.follow(username, userProfile);
                            if (didFollow) {
                                logger.info(`Followed ${username}`);
                                this.saver.saveFollowed(username);
                            } else {
                                logger.info('Did not follow users', { reason: err });
                            }
                            logger.info('Navigating back');
                            await this.browser.goBack();
                        }
                    }
                }
                if (onInteracted) {
                    onInteracted();
                }
                logger.info('Done with post');
                logger.info('Navigating back');
                await this.browser.goBack();
                await utils.sleep(2000);
            }
            logger.info('Done with tag', { tag, totalPosts: posts.length })
        }
    }


}