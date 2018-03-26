module.exports = {

    clickLogin: async function (chrome) {
        const clickLogin = `document.querySelector('a[href="/accounts/login/"]').click();`;
        // Evaluate the JS expression in the page.
        let { result } = await chrome.evaluate(clickLogin);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    isLoggedIn: async function (username, chrome) {
        const isLoggedInHREF = `document.querySelector('a[href="/${username}/"]')`;
        // Evaluate the JS expression in the page.
        let { result } = await chrome.evaluate(isLoggedInHREF);
        return result.type == 'object' && result.subtype == 'node';
    },

    setLoginDetailsOnLogin: async function (username, password, chrome) {
        const setUsernameInput = `document.querySelector('input[name="username"]').focus()`;
        await chrome.evaluate(setUsernameInput);
        await chrome.inputString(username);
        await timeout(1000);
        const setPasswordInput = `document.querySelector('input[name="password"]').focus()`;
        var { result } = await chrome.evaluate(setPasswordInput);
        await chrome.inputString(password);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    submitLogin: async function (chrome) {
        let js = `document.evaluate("//form/span/button[text()='Log in']", document, null, XPathResult.ANY_TYPE,null).iterateNext().click()`;
        let { result } = await chrome.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    submitSuspiciousAttempt: async function (chrome) {
        let js = `document.evaluate("//form/span/button[text()='Send Security Code']", document, null, XPathResult.ANY_TYPE,null).iterateNext().click()`;
        let { result } = await chrome.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    isWaitingForCode: async function (chrome) {
        let js = `document.querySelector('a[href="javascript:_replay()"');`
        let { result } = await chrome.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    inputCode: async function (inputCode, chrome) {
        let js = `document.querySelector('input[name="security_code"]').focus();`
        var { result } = await chrome.evaluate(js);
        await chrome.inputString(inputCode);
        return !(result.type == 'object' && result.subtype == 'error');
    },

    validateSecurityCode: async function (chrome) {
        let js = `document.evaluate("//form/span/button[text()='Submit']", document, null, XPathResult.ANY_TYPE,null).iterateNext().click()`;
        let { result } = await chrome.evaluate(js);
        return !(result.type == 'object' && result.subtype == 'error');
    },
    hasSuspiciousLoginAttempt: async function (chrome) {
        let js = `document.evaluate("//p[text()='Suspicious Login Attempt']", document, null, XPathResult.ANY_TYPE,null).iterateNext().innerHTML`;
        let { result } = await chrome.evaluate(js);
        return result.type == 'string' && result.value == 'Suspicious Login Attempt';
    }
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}