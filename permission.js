var DiscordPermissions = require('discord.io').Permissions;

module.exports.canMoveUsers = function canMoveUsers(bot, userID){
    var userPermissions = getUserPermissions(bot, userID);
    for (var i = 0; i < userPermissions.length; i++){
        if (((userPermissions[i] >> DiscordPermissions.VOICE_MOVE_MEMBERS) & 1 ) == 1){
            return true;
        }
    }
    return false;
}

function getUserPermissions(bot, userID){
    var userPermissions = [];

    server = bot.servers[bot.serverID];
    userRoles = server.members[userID].roles;
    console.log(userRoles);
    for (var i = 0; i < userRoles.length; i++){
        role = server.roles[userRoles[i]];
        userPermissions.push(role._permissions);
    }
    return userPermissions;
}