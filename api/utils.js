module.exports = {
    checkChance: function (chance) {
        let randNum = Math.floor(Math.random() * 100) + 1;
        if (randNum <= chance) {
            return true;
        }
        return false;
    },

    randRange: function(min, max) {
        return Math.floor(Math.random() * max) + min;
    }
}