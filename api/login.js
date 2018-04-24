module.exports = {

    clickLogin: async function (browser) {
        const clickLogin = `document.querySelector('a[href="/accounts/login/"]').click();`;
        // Evaluate the JS expression in the page.
        let { result } = await browser.evaluate(clickLogin);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    isLoggedIn: async function (username, browser) {
        const isLoggedInHREF = `document.querySelector('a[href="/${username}/"]')`;
        // Evaluate the JS expression in the page.
        let { result } = await browser.evaluate(isLoggedInHREF);
        return result.type == 'object' && result.subtype == 'node';
    },

    setLoginDetailsOnLogin: async function (username, password, browser) {
        const setUsernameInput = `document.querySelector('input[name="username"]').focus()`;
        await browser.evaluate(setUsernameInput);
        await browser.inputString(username);
        await sleep(1000);
        const setPasswordInput = `document.querySelector('input[name="password"]').focus()`;
        var { result } = await browser.evaluate(setPasswordInput);
        await browser.inputString(password);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    submitLogin: async function (browser) {
        let js = `document.evaluate("//form/span/button[text()='Log in']", document, null, XPathResult.ANY_TYPE,null).iterateNext().click()`;
        let { result } = await browser.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    submitSuspiciousAttempt: async function (browser) {
        let js = `document.evaluate("//form/span/button[text()='Send Security Code']", document, null, XPathResult.ANY_TYPE,null).iterateNext().click()`;
        let { result } = await browser.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    isWaitingForCode: async function (browser) {
        let js = `document.querySelector('a[href="javascript:_replay()"');`
        let { result } = await browser.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    inputCode: async function (inputCode, browser) {
        let js = `document.querySelector('input[name="security_code"]').focus();`
        var { result } = await browser.evaluate(js);
        await browser.inputString(inputCode);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    validateSecurityCode: async function (browser) {
        let js = `document.evaluate("//form/span/button[text()='Submit']", document, null, XPathResult.ANY_TYPE,null).iterateNext().click()`;
        let { result } = await browser.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },
    hasSuspiciousLoginAttempt: async function (browser) {
        let js = `document.evaluate("//p[text()='Suspicious Login Attempt']", document, null, XPathResult.ANY_TYPE,null).iterateNext().innerHTML`;
        let { result } = await browser.evaluate(js);
        return result.type == 'string' && result.value == 'Suspicious Login Attempt';
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}