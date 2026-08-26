import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configure } from '@vendia/serverless-express';
import { Callback, Context, Handler } from 'aws-lambda';
import { AppModule } from './app.module';

let cachedServer: Handler;

async function bootstrap(): Promise<Handler> {
  if (cachedServer) {
    return cachedServer;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Alora-Tenant-Id',
  });

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  cachedServer = configure({ app: expressApp });
  return cachedServer;
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
): Promise<any> => {
  const server = await bootstrap();
  return server(event, context, callback);
};
