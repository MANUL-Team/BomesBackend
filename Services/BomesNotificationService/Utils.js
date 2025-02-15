function GetUserFromDB(connection, identifier){
    const sql = "SELECT * FROM `users` WHERE identifier = ?";
    const data = [identifier];

    return new Promise((resolve, reject) => {
        connection.query(sql, data, function (err, result) {
            if (err) reject(err);
            else {
                const item = result[0];
                if (item) {
                    const user = {
                        identifier: item.identifier,
                        email: item.email,
                        password: item.password,
                        username: item.username,
                        avatar: item.avatar,
                        description: item.description,
                        lastOnline: item.lastOnline,
                        tokens: JSON.parse(item.tokens),
                        friends: JSON.parse(item.friends),
                    }
                    resolve(user);
                }
                else{
                    console.log("ERROR! Identifier: " + identifier);
                }
            }
        });
    });
}

module.exports = {
    GetUserFromDB
}
