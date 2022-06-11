import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {AppConfig} from './config/appConfig'
import { writeFile, readFileSync} from 'fs';
import { BotClient } from './bot.js';
import { Logger } from 'winston';
import { sendTextMessageToAllGuilds } from './util/util';

const EPIC_GAMES_REQUEST_URL = "https://api.twitter.com/2/users/by?usernames=EpicGames&user.fields=created_at&expansions=pinned_tweet_id&tweet.fields=author_id,created_at";
const TWITTER_LINK_FORMAT = "https://twitter.com/EpicGames/status/";
const TWEET_FILE_NAME = "tweet.txt";

function getRequestOptions(appConfig: AppConfig): AxiosRequestConfig {
    return {
        method: 'get',
        url: EPIC_GAMES_REQUEST_URL,
        headers: {
            'Authorization': "Bearer " + appConfig.auth.twitter
        }
    }
}

export function messageEpicFreeGamesTweet(logger: Logger, appConfig: AppConfig, bot: BotClient, gamedayGroup: string) {
    axios.get(EPIC_GAMES_REQUEST_URL, getRequestOptions(appConfig))
        .then(response => {
            var pinnedTweet = getPinnedTweet(response);
            logger.info("Pinned Tweet:", pinnedTweet);

            if (pinnedTweet){
                if (isFreeGamesTweet(logger, pinnedTweet.text) && updateTweetFile(logger, pinnedTweet.id)) {
                    var tweetLink = TWITTER_LINK_FORMAT + pinnedTweet.id;
                    logger.info(`Tweet Link: ${tweetLink}`);
                    sendTextMessageToAllGuilds(appConfig, bot, `${gamedayGroup} Check out this free game from Epic\n ${tweetLink}`);
                }
            } else {
                logger.error("Did not find a pinned tweet");
            }
        }).catch(err => {
            logger.error(err);
        });
}

function getPinnedTweet(response: AxiosResponse){
    response.data.includes.tweets[0].text;
    var pinnedTweet = response && response.data && response.data.includes && response.data.includes.tweets && response.data.includes.tweets[0];
    
    // Will be null if response didn't have pinned tweet
    return pinnedTweet;
}

function isFreeGamesTweet(logger: Logger, tweetText: string) {
    var lowerTweetText = tweetText.toLowerCase();
    var isFreeGame = lowerTweetText.includes(" free ");
        
    if (!isFreeGame) {
        logger.error("Tweet text doesn't look like a free game");
    }
    return isFreeGame;
}

function updateTweetFile(logger: Logger, newTweetId: string) {
    try {
        const data = readFileSync(TWEET_FILE_NAME, 'utf-8');
        if (data == newTweetId) {
            logger.info("The tweet id from the file matches the new tweet id. Skipping writing id to file.")
            return false;
        }        
    } catch (err) {
        logger.error(err);
    }

    writeTweetFile(logger, newTweetId);
    
    return true
}

function writeTweetFile(logger: Logger, data: string) {
    writeFile(TWEET_FILE_NAME, data, function(err){
        if (err) return logger.error(err);
        logger.info(`${data} > ${TWEET_FILE_NAME}`);
    });
}
