import request from 'request';
import config from './config/auth.js';

const EPIC_GAMES_REQUEST_URL = "https://api.twitter.com/2/users/by?usernames=EpicGames&user.fields=created_at&expansions=pinned_tweet_id&tweet.fields=author_id,created_at";
const TWITTER_LINK_FORMAT = "https://twitter.com/EpicGames/status/";


const options = {
    url: EPIC_GAMES_REQUEST_URL,
    headers: {
        'Authorization': "Bearer " + config.twitter
    }
}

export function messageEpicFreeGamesTweet(bot, gamedayGroup) {
    request(options,function callback (error, response, body) {
        console.error('error', error);
        console.log('statusCode:', response && response.statusCode);
        var pinnedTweet = getPinnedTweet(body);
        console.log("Pinned Tweet:", pinnedTweet);
        if (pinnedTweet){
            if (isFreeGamesTweet(pinnedTweet.text)) {
                var tweetLink = TWITTER_LINK_FORMAT + pinnedTweet.id;
                console.log("Tweet Link:", tweetLink);
                bot.textChannels[0].send(`${gamedayGroup} Check out this weeks free games from Epic\n ${tweetLink}`);
            } else {
                console.error("The pinned tweet didn't look like free games")
            }
        } else {
            console.error("Did not find a pinned tweet");
        }
    });
}


function getPinnedTweet(tweetResponseBody){
    //console.log('body:', tweetResponseBody);
    var response = JSON.parse(tweetResponseBody);
    var pinnedTweet = response && response.includes && response.includes.tweets && response.includes.tweets[0];
    
    // Will be null if response didn't have pinned tweet
    return pinnedTweet;
}

function isFreeGamesTweet(tweetText) {
    return tweetText.includes("FREE THIS WEEK");
}
