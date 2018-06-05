const POST_SELECTOR_USERNAME = '.FPmhX.notranslate.nJAzx';

module.exports = {
    username: async function (browser) {
        let { result } = await browser.evaluate(`document.querySelector('${POST_SELECTOR_USERNAME}').text`);
        if (!result.type === 'string') throw new Error('Could not find username');
        return result.value;
    },
    userProfile: async function(browser, logger) {
        let { result } = await browser.evaluate(`document.querySelector('${POST_SELECTOR_USERNAME}').href`);
        if (result.type != 'string') {
            logger.error('Could not find profile link', { result })
            return '';
        }
        let profileLink = result.value;
        return profileLink;
    }
}