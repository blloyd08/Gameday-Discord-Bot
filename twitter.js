import request from 'request';
import config from './config/auth.js';
import { writeFile, readFileSync} from 'fs';

const EPIC_GAMES_REQUEST_URL = "https://api.twitter.com/2/users/by?usernames=EpicGames&user.fields=created_at&expansions=pinned_tweet_id&tweet.fields=author_id,created_at";
const TWITTER_LINK_FORMAT = "https://twitter.com/EpicGames/status/";
const TWEET_FILE_NAME = "tweet.txt";


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
            if (isFreeGamesTweet(pinnedTweet.text) && updateTweetFile(pinnedTweet.id)) {
                var tweetLink = TWITTER_LINK_FORMAT + pinnedTweet.id;
                console.log("Tweet Link:", tweetLink);
                bot.textChannels[0].send(`${gamedayGroup} Check out this free game from Epic\n ${tweetLink}`);
            }
        } else {
            console.error("Did not find a pinned tweet");
        }
    });
}


function getPinnedTweet(tweetResponseBody){
    var response = JSON.parse(tweetResponseBody);
    var pinnedTweet = response && response.includes && response.includes.tweets && response.includes.tweets[0];
    
    // Will be null if response didn't have pinned tweet
    return pinnedTweet;
}

function isFreeGamesTweet(tweetText) {
    var lowerTweetText = tweetText.toLowerCase();
    var isFreeGame = lowerTweetText.includes(" free ");
        
    if (!isFreeGame) {
        console.error("Tweet text doesn't look like a free game");
    }
    return isFreeGame;
}

function updateTweetFile(newTweetId) {
    try {
        const data = readFileSync(TWEET_FILE_NAME, 'utf-8');
        if (data == newTweetId) {
            console.log("The tweet id from the file matches the new tweet id. Skipping writing id to file.")
            return false;
        }        
    } catch (err) {
        console.error(err);
    }

    writeTweetFile(newTweetId);
    
    return true
}

function writeTweetFile(data) {
    writeFile(TWEET_FILE_NAME, data, function(err){
        if (err) return console.error(err);
        console.log(`${data} > ${TWEET_FILE_NAME}`);
    });
}
