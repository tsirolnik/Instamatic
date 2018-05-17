const sqlite3 = require('sqlite3').verbose();

module.exports = class SqliteSaver {

    constructor(dbname) {
        this.db = new sqlite3.Database(dbname);
        this.db.run("CREATE TABLE IF NOT EXISTS followed (identifier TEXT, timestamp INTEGER, id INTEGER PRIMARY KEY AUTOINCREMENT)");
        this.db.run("CREATE TABLE IF NOT EXISTS commented (identifier TEXT, timestamp INTEGER, id INTEGER PRIMARY KEY AUTOINCREMENT)");
        this.db.run("CREATE TABLE IF NOT EXISTS liked (identifier TEXT, timestamp INTEGER, id INTEGER PRIMARY KEY AUTOINCREMENT)");
    }

    saveFollowed(account) {
        this.saveToDB(account, 'followed');
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
        this.saveToDB(post, 'commented');
    }

    saveLiked(post) {
        this.saveToDB(post, 'liked');
    }

    totalFollowed() {
        return new Promise((resolve, reject) => {
            let query = `SELECT COUNT(*) as total FROM followed'`;
            this.db.get(query, (err, row) => {
                if (err) return reject(err);
                let { total } = row;
                resolve(total);
            });
        });
    }

    getByIdentifier(identifier, table, timestampQuery = undefined) {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM ${table} WHERE identifier = '${identifier}'`;
            if (timestampQuery) {
                let { operator, timestamp } = timestampQuery;
                query = query + ` timestamp ${operator} ${timestamp}`;
            }
            this.db.all(query, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    saveToDB(identifier, table) {
        let now = Date.now();
        this.db.run(`INSERT INTO ${table} (identifier, timestamp) VALUES("${identifier}", ${now})`);
    }

}