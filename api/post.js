module.exports = {
    username: async function (browser) {
        let { result } = await browser.evaluate(`document.querySelector('._2g7d5.notranslate._iadoq').text`);
        if (!result.type === 'string') throw new Error('Could not find username');
        return result.value;
    },
    userProfile: async function(browser) {
        let { result } = await browser.evaluate(`document.querySelector('._2g7d5.notranslate._iadoq').href`);
        if (result.type != 'string') {
            logger.error('Could not find profile link', { result })
            return '';
        }
        let profileLink = result.value;
        return profileLink;
    }
}