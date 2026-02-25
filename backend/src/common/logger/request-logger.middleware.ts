import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      // log enxuto e estruturado
      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          method,
          url: originalUrl,
          status,
          ms,
          ip: req.ip,
        }),
      );
    });

    next();
  }
}
