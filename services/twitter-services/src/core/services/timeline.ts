import type { TwitterService } from '../../types/services'
import type { Context } from '../browser/context'
import type { Tweet } from './tweet'

import { TWITTER_HOME_URL } from '../../../constants'
import { TweetParser } from '../../parsers/tweet-parser'
import { logger } from '../../utils/logger'
import { SELECTORS } from '../../utils/selectors'

/**
 * Timeline Options
 */
export interface TimelineOptions {
  count?: number
  includeReplies?: boolean
  includeRetweets?: boolean
  limit?: number
  onProgress?: (progress: number, status: string) => void
}

export function useTwitterTimelineServices(ctx: Context): TwitterService {
  async function getTimeline(options: TimelineOptions = {}): Promise<Tweet[]> {
    try {
      logger.timeline.withFields({ options }).log('Fetching timeline')

      // Report initial progress
      options.onProgress?.(0, 'Navigating to Twitter')

      // Navigate to home page
      await ctx.page.goto(TWITTER_HOME_URL)

      // Report progress
      options.onProgress?.(10, 'Waiting for timeline to load')

      // Wait for timeline to load
      await ctx.page.waitForSelector(SELECTORS.TIMELINE.TWEET, { timeout: 10000 })

      // Report progress
      options.onProgress?.(20, 'Initial timeline loaded')

      // Optional: scroll to load more tweets if needed
      if (options.count && options.count > 5) {
        await scrollToLoadMoreTweets(Math.min(options.count, 20), options.onProgress)
      }

      // Report progress
      options.onProgress?.(80, 'Parsing tweets')

      // Parse all tweets directly from the DOM using Playwright
      const tweets = await TweetParser.parseTimelineTweets(ctx.page)

      logger.timeline.log(`Found ${tweets.length} tweets in timeline`)

      // Report progress
      options.onProgress?.(85, 'Applying filters')

      // Apply filters
      let filteredTweets = tweets

      if (options.includeReplies === false) {
        filteredTweets = filteredTweets.filter(tweet => !tweet.text.startsWith('@'))
      }

      if (options.includeRetweets === false) {
        filteredTweets = filteredTweets.filter(tweet => !tweet.text.startsWith('RT @'))
      }

      // Apply count limit if specified
      if (options.count) {
        filteredTweets = filteredTweets.slice(0, options.count)
      }

      // Report completion
      options.onProgress?.(100, 'Timeline fetched successfully')

      return filteredTweets
    }
    catch (error) {
      logger.timeline.error('Failed to get timeline:', (error as Error).message)
      options.onProgress?.(100, `Error: ${(error as Error).message}`)
      return []
    }
  }

  async function scrollToLoadMoreTweets(targetCount: number, onProgress?: (progress: number, status: string) => void): Promise<void> {
    try {
    // Initial tweet count
      let previousTweetCount = 0
      let currentTweetCount = await countVisibleTweets()
      let scrollAttempts = 0
      const maxScrollAttempts = 10

      logger.timeline.log(`Initial tweet count: ${currentTweetCount}, target: ${targetCount}`)

      // Scroll until we have enough tweets or reach maximum scroll attempts
      while (currentTweetCount < targetCount && scrollAttempts < maxScrollAttempts) {
        // Report progress (20-75% of overall progress, scaled by tweet loading progress)
        if (onProgress) {
          const loadingProgress = Math.min(100, (currentTweetCount / targetCount) * 100)
          const overallProgress = 20 + Math.floor(loadingProgress * 0.55) // Scale to 20-75% range
          onProgress(overallProgress, `Loading tweets: ${currentTweetCount}/${targetCount}`)
        }

        // Scroll down using Playwright's mouse wheel simulation
        await ctx.page.mouse.wheel(0, 800)

        // Wait for new content to load
        await ctx.page.waitForTimeout(1000)

        // Check if we have new tweets
        previousTweetCount = currentTweetCount
        currentTweetCount = await countVisibleTweets()

        // If no new tweets were loaded, we might have reached the end
        if (currentTweetCount === previousTweetCount) {
          scrollAttempts++
        }
        else {
          scrollAttempts = 0 // Reset counter if we're still loading tweets
        }

        logger.timeline.debug(`Scrolled for more tweets: ${currentTweetCount}/${targetCount}`)
      }

      // Final progress report for scrolling
      if (onProgress) {
        onProgress(75, `Loaded ${currentTweetCount} tweets`)
      }
    }
    catch (error) {
      logger.timeline.error('Error while scrolling for more tweets:', (error as Error).message)
      onProgress?.(75, `Error while scrolling: ${(error as Error).message}`)
    }
  }

  async function countVisibleTweets(): Promise<number> {
    const tweetElements = await ctx.page.$$(SELECTORS.TIMELINE.TWEET)
    return tweetElements.length
  }

  return {
    getTimeline,
  }
}
