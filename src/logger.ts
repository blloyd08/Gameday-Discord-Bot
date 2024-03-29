import { createLogger as createWinstonLogger, format, transports, Logger } from "winston";

export function createLogger(serviceName: string, logLevel: string): Logger {
  const logger = createWinstonLogger({
        level: logLevel,
        format: format.combine(
          format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          format.errors({ stack: true }),
          format.splat(),
          format.json()
        ),
        defaultMeta: { service: serviceName },
        transports: [
          new transports.File({ filename: './out/bot-error.log', level: 'error' }),
          new transports.File({ filename: './out/bot-combined.log' })
        ]
    });
    
    //
    // If we're not in production then **ALSO** log to the `console`
    // with the colorized simple format.
    //
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }));
    }
    return logger;
}