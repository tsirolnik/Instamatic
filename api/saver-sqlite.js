const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ],
    exitOnError: false
});

module.exports = class SqliteSaver {

    constructor(dbname) {
        this.db = new sqlite3.Database(dbname);
        this.db.run("CREATE TABLE IF NOT EXISTS followed (identifier TEXT, timestamp INTEGER, id INTEGER PRIMARY KEY AUTOINCREMENT)");
        this.db.run("CREATE TABLE IF NOT EXISTS commented (identifier TEXT, timestamp INTEGER, id INTEGER PRIMARY KEY AUTOINCREMENT)");
        this.db.run("CREATE TABLE IF NOT EXISTS liked (identifier TEXT, timestamp INTEGER, id INTEGER PRIMARY KEY AUTOINCREMENT)");
    }

    saveFollowed(account) {
        return this.saveToDB(account, 'followed');
    }

    removeFollow(account) {
        return this.removeFromDB(account, 'followed');
    }

    getAllFollowed(timestampQuery = undefined) {
        return this.getAll('followed', timestampQuery);
    }

    getFollowed(account, timestampQuery = undefined) {
        return this.getByIdentifier(account, 'followed', timestampQuery);
    }

    getCommented(post, timestampQuery = undefined) {
        return this.getByIdentifier(post, 'commented', timestampQuery);
    }

    getLiked(post, timestampQuery = undefined) {
        return this.getByIdentifier(post, 'liked', timestampQuery);
    }

    saveCommented(post) {
        return this.saveToDB(post, 'commented');
    }

    saveLiked(post) {
        return this.saveToDB(post, 'liked');
    }

    totalFollowed() {
        return new Promise((resolve, reject) => {
            let query = `SELECT COUNT(*) as total FROM followed`;
            this.db.get(query, (err, row) => {
                if (err) return reject(err);
                let { total } = row;
                resolve(total);
            });
        });
    }

    getAll(table, timestampQuery = undefined) {
        logger.info('Getting all', { table, timestampQuery });
        let params = [];
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM ${table}`;
            if (timestampQuery) {
                let { operator, timestamp } = timestampQuery;
                query = query + ` WHERE timestamp ${operator} ?`;
                params.push(timestamp);
            }
            this.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    getByIdentifier(identifier, table, timestampQuery = undefined) {
        logger.info('Getting by identifier', { identifier, table, timestampQuery });
        let params = [];
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM ${table} WHERE identifier = ?`;
            params.push(identifier);
            if (timestampQuery) {
                let { operator, timestamp } = timestampQuery;
                query = query + ` timestamp ${operator} ?`;
                params.push(timestamp);
            }
            this.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    removeFromDB(identifier, table) {
        return new Promise((resolve, reject) => {
            logger.info('Removing from database', { identifier, table });
            let now = Date.now();
            this.db.run(`DELETE FROM ${table} WHERE identifier = ?`, identifier, (res, err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    saveToDB(identifier, table) {
        return new Promise((resolve, reject) => {
            logger.info('Saving to database', { identifier, table });
            let now = Date.now();
            this.db.run(`INSERT INTO ${table} (identifier, timestamp) VALUES(?, ?)`, identifier, now, (res, err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

}