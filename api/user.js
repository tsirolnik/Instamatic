module.exports = {

    getFollowersCount: async function (browser) {
        let { result } = await browser.evaluate(`document.evaluate('string(//span[@class="g47SY "]/@title)', document, null, XPathResult.ANY_TYPE, null).stringValue;`);
        if(result.type != 'string') {
            throw new Error('Could not get followers count');
        }
        let followersString = result.value;
        let followers = Number(followersString.replace(/,/g, ''));
        return followers;
    },

    getUsername: async function (browser) {
        let { result } = await browser.evaluate(`document.querySelector('h1').innerText`);
        if (!result.type === 'string') throw new Error('Could not find username');
        return result.value;
    },

    follow: async function (browser) {
        await browser.evaluate(`document.evaluate('//button[contains(child::text(), \"Follow\")]', document, null, XPathResult.ANY_TYPE, null).iterateNext().click();`);
    },

    unfollow: async function (browser) {
        await browser.evaluate(`document.evaluate('//button[contains(child::text(), \"Following\")]', document, null, XPathResult.ANY_TYPE, null).iterateNext().click();`);
    }

}