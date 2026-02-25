import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const logLine = `${method} ${originalUrl} ${status} ${ms}ms`;

      if (status >= 500) {
        this.logger.error(logLine);
      } else if (status >= 400) {
        this.logger.warn(logLine);
      } else {
        this.logger.log(logLine);
      }
    });

    next();
  }
}
