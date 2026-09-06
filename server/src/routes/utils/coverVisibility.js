"use strict";

const path = require("path");

function sendHiddenCover(req, res, next, work) {
    if (req.query.hideNsfw !== "1" || work?.nsfw === false || work?.nsfw === 0) {
        return false;
    }
    res.sendFile(path.join(__dirname, "../../static/no-image.jpg"), error => {
        if (error) next(error);
    });
    return true;
}

module.exports = { sendHiddenCover };
