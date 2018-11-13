const Command = require('../core/commands/command');
const LoggerFactory = require('../core/logging/logger-factory');
const QueryBuilder = require('./query-builder');
const TimeUnit = require('../core/time/time-unit');
const { getEventMetadata } = require('../core/logging/logging-metadata');

const searchWithDefaultWindow       = /search `(.+)`\s*$/;
const searchWithTimeToSearch        = /search `(.+)` last (\d+) ?(minutes?|mins?|m|hours?|h)\s*$/;
const searchWithSpecificTimeWindow  = /search `(.+)` from (.+) to (.+)\s*$/;

const logger = LoggerFactory.getLogger(__filename);

function runSearchAndSendResults(command, bot, message, query, attachmentTitle) {
  command.searchClient.search(message.team, query)
    .then(searchResult => {
      bot.api.files.upload({
        content: JSON.stringify(searchResult, null, 2),
        channels: message.channel,
        filename: attachmentTitle,
        filetype: 'javascript'
      }, err => {
        if (err) {
          logger.error('Failed to send query results', err);
        }
      });
    })
    .catch(err => {
      command.handleError(bot, message, err, err => {
        bot.reply(message, 'Unknown error occurred while performing your search.\n' +
          'Please try again later or contact support.');
        logger.error(`Unknown error occurred while performing user search: [${JSON.stringify(query)}]`, err);
      });
    });
}

class SearchCommand extends Command {

  constructor(searchClient) {
    super();
    this.searchClient = searchClient;
  }

  configure(controller) {
    controller.hears([searchWithDefaultWindow], 'direct_message,direct_mention', (bot, message) => {
      logger.info(`User ${message.user} from team ${message.team} triggered a search with default time frame`, getEventMetadata(message, 'search'));
      const matches = message.text.match(searchWithDefaultWindow);
      const queryString = matches[1];
      const query = new QueryBuilder()
        .withQueryString(queryString)
        .build();

      runSearchAndSendResults(this, bot, message, query, `Search results for query: \`${queryString}\``);
    });

    controller.hears([searchWithTimeToSearch], 'direct_message,direct_mention', (bot, message) => {
      logger.info(`User ${message.user} from team ${message.team} triggered a search with relative time frame`, getEventMetadata(message, 'search'));
      const matches = message.text.match(searchWithTimeToSearch);
      const queryString = matches[1];
      const timeValue = matches[2];
      const timeUnitStr = matches[3];

      const query = new QueryBuilder()
        .withQueryString(queryString)
        .withRelativeTime(timeValue, TimeUnit.parse(timeUnitStr))
        .build();

      runSearchAndSendResults(this, bot, message, query, `Search results for query: \`${queryString}\``);
    });

    controller.hears([searchWithSpecificTimeWindow], 'direct_message,direct_mention', (bot, message) => {
      logger.info(`User ${message.user} from team ${message.team} triggered a search with absolute time frame`, getEventMetadata(message, 'search'));
      const matches = message.text.match(searchWithSpecificTimeWindow);
      const queryString = matches[1];
      const fromTS = matches[2];
      const toTS = matches[3];

      const query = new QueryBuilder()
        .withQueryString(queryString)
        .withExactTime(fromTS, toTS)
        .build();

      runSearchAndSendResults(this, bot, message, query, `Search results for query: \`${queryString}\``);
    });
  }

  getCategory() {
    return 'search';
  }

  getUsage() {
    return [
      '*search \u034f`&lt;query-string&gt;`* - Get the query results for the last 15 minutes',
      '*search \u034f`&lt;query-string&gt;` last &lt;time-value&gt; &lt;time-unit&gt;* - Get the query results for the last _x_ minutes or hours',
      '*search \u034f`&lt;query-string&gt;` from &lt;from-timestamp&gt; to &lt;to-timestamp&gt;* - Get the query results between the start and end times',
    ];
  }

}

module.exports = SearchCommand;
