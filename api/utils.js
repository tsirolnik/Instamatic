const winston = require('winston');
const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ],
    exitOnError: false
});

module.exports = {
    checkChance: function (chance) {
        let randNum = Math.floor(Math.random() * 100) + 1;
        if (randNum <= chance) {
            return true;
        }
        return false;
    },

    randRange: function (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    sleep: function(ms) {
        logger.info('Sleeping', { ms, now: Date.now() });
        return new Promise(resolve => {
            setTimeout(() => {
                logger.info('Slept', { ms, now: Date.now() });
                resolve();
            }, ms);
        });
    }
}