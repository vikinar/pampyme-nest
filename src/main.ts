import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('PampyMe API Docs')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true, // Игнорирует поля, которых нет в DTO
      forbidNonWhitelisted: true, // Генерирует ошибку, если переданы невалидные поля
      transform: true, // Преобразует входные данные в соответствующий тип (например, преобразует строки в числа)
    }),
  );

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-doc', app, document); // Swagger будет доступен по адресу /api

  await app.listen(4200);
}
bootstrap();
