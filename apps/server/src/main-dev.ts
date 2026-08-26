import { bootstrapApp } from './bootstrap';

async function bootstrap() {
  const { app } = await bootstrapApp();

  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`Alora server running on: http://localhost:${port}`);
}

void bootstrap();
