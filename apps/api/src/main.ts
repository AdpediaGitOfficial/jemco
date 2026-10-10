import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.setGlobalPrefix("v1");
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });

  const doc = new DocumentBuilder().setTitle("JEMCO Complaint & NCR API").setVersion("1").build();
  SwaggerModule.setup("v1/docs", app, SwaggerModule.createDocument(app, doc));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/v1 (docs at /v1/docs)`);
}
bootstrap();
