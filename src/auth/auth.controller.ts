import {
  Controller,
  Post,
  Req,
  Res,
  Body,
  HttpCode,
  UnauthorizedException,
  InternalServerErrorException,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiBody,
  ApiResponse,
  ApiCookieAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { SignUpDto, SignInDto } from './auth.dto';
import { I18nLang, I18nService, logger } from 'nestjs-i18n';

@Controller('auth')
@ApiTags('Auth') // Группируем маршруты под тегом Auth в документации Swagger
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  @Get('all-translations')
  async getAllTranslations() {
    const translations = await this.i18n.getTranslations();
    console.log('Loaded translations:', translations);
    return { translations };
  }

  @Post('sign-up')
  @ApiBody({ type: SignUpDto }) // Описание тела запроса
  @ApiResponse({ status: 201, description: 'User registered successfully.' }) // Успешный ответ
  @ApiResponse({ status: 400, description: 'User already exists.' }) // Ошибка при существующем пользователе
  @ApiResponse({ status: 500, description: 'Internal Server Error.' }) // Общая ошибка сервера
  async signUp(
    @Body() signUpDto: SignUpDto,
    @Res() res: Response,
    @I18nLang() lang: string,
  ) {
    try {
      // Проверяем, существует ли пользователь с таким email
      const existingUser = await this.authService.findUserByEmail(
        signUpDto.email,
      );

      if (existingUser) {
        return res
          .status(400)
          .json({ error: this.i18n.t('common.error.user_exists', { lang }) });
      }

      // Создаём нового пользователя
      const newUser = await this.authService.createUser(signUpDto);

      const accessToken = this.authService.generateAccessToken(
        newUser.id,
        newUser.email,
      );
      const refreshToken = this.authService.generateRefreshToken(newUser.id);

      // Сохраняем refresh token в куки
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 604800000, // 7 дней
      });

      return res.status(201).json({ success: 'Success!' });
    } catch (error) {
      throw new InternalServerErrorException('Failed to register user.', error);
    }
  }

  @Post('sign-in')
  @HttpCode(200)
  @ApiBody({ type: SignInDto }) // Описание тела запроса
  @ApiResponse({ status: 200, description: 'User signed in successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 403, description: 'Forbidden access.' }) // Если доступ запрещён
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signIn(
    @Body() body: SignInDto, // DTO для тела запроса
    @Res() res: Response,
    @I18nLang() lang: string,
  ) {
    try {
      // Поиск пользователя по email
      const user = await this.authService.findUserByEmail(body.email);

      if (!user) {
        throw new UnauthorizedException(
          this.i18n.t('error.invalid_credentials', { lang }),
        );
      }

      // Проверка правильности пароля
      const isPasswordValid = await this.authService.validatePassword(
        body.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException(
          this.i18n.t('common.error.invalid_credentials', { lang }),
        );
      }

      const accessToken = this.authService.generateAccessToken(
        user.id,
        user.email,
      );
      const refreshToken = this.authService.generateRefreshToken(user.id);

      // Сохранение refresh token в куки
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 604800000, // 7 дней
      });

      return res.json({ accessToken });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to sign in.');
    }
  }

  @Post('refresh-token')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Refresh the JWT access token using the refresh token from cookies',
  })
  @ApiCookieAuth() // Указываем, что токен берется из cookie
  @ApiBody({
    description: 'Refresh token is sent in the cookie',
  }) // Описываем, что отправляем
  @ApiResponse({
    status: 200,
    description: 'User signed in successfully.',
  }) // Описываем, что получаем
  @ApiResponse({ status: 401, description: 'Refresh token not found.' })
  @ApiResponse({ status: 403, description: 'Invalid refresh token.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const payload = this.authService.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const newAccessToken = this.authService.generateAccessToken(
        payload.sub,
        payload.email,
      );

      // Возвращаем новый Access Token в формате, который будет виден в Swagger
      return res.json({ accessToken: newAccessToken });
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw new InternalServerErrorException('Failed to refresh token.');
    }
  }
}
