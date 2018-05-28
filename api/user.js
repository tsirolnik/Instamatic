module.exports = {

    getFollowersNumber: async function (browser) {
        let nodes = await browser.getNodesByXPath(`//span[@class="_fd86t "]/text()`);
        if (nodes.length === 0) {
            throw new Error('Could not get user total followers');
        }
        let followersString = nodes[1].value;
        let followers = Number(followersString.replace(/,/g, ''));
        return followers;
    },

    getUsername: async function (browser) {
        let { result } = await browser.evaluate(`document.querySelector('h1').innerText`);
        if (!result.type === 'string') throw new Error('Could not find username');
        return result.value;
    },

    follow: async function (browser) {
        await browser.evaluate(`document.querySelector('._qv64e._gexxb._r9b8f._njrw0').click();`);
    },

    unfollow: async function (browser) {
        await browser.evaluate(`cument.querySelector('._qv64e._t78yp._r9b8f._njrw0').click();`);
    }

}