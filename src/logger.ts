import { createLogger as createWinstonLogger, format, transports, Logger } from "winston";
import DailyRotateFile from 'winston-daily-rotate-file';

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
          new DailyRotateFile({
            level: 'error',
            filename: 'bot-error-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
          }),
          new DailyRotateFile({
            level: 'error',
            filename: 'bot-combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
          }),
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