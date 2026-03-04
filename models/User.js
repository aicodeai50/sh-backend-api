/**
 * models/User.js
 *
 * IMPORTANT:
 * The User model is defined in database.js.
 * This file only re-exports it so existing imports continue working.
 */

const { User } = require("../database");

module.exports = User;
