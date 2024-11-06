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
import {
  SignInDto,
  UserType,
  SignUpStepOneDto,
  SignUpStepTwoDto,
} from './auth.dto';
import { I18nLang, I18nService } from 'nestjs-i18n';

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

  @Post('sign-up/step1')
  @ApiBody({ type: SignUpStepOneDto })
  @ApiResponse({ status: 201, description: 'Step 1 completed successfully.' })
  @ApiResponse({ status: 400, description: 'User already exists.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signUpStepOne(
    @Body() signUpStepOneDto: SignUpStepOneDto,
    @Res() res: Response,
    @I18nLang() lang: string,
  ) {
    try {
      const existingUser = await this.authService.findUserByEmail(
        signUpStepOneDto.email,
      );

      if (existingUser) {
        return res.status(400).json({
          error: {
            message: this.i18n.t('common.error.user_exists', { lang }),
          },
        });
      }

      // Создаём пользователя с базовыми данными
      const tempUser =
        await this.authService.createUserWithEmailAndPassword(signUpStepOneDto);

      // Определяем тип пользователя и сохраняем его
      tempUser.userType = signUpStepOneDto.userType;
      if (signUpStepOneDto.userType === UserType.BUSINESS) {
        tempUser.businessType = signUpStepOneDto.businessType;
      }

      await this.authService.saveUser(tempUser);

      return res.status(201).json({
        success: {
          data: this.i18n.t('common.success.user_registered', { lang }),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to complete step 1.',
        error,
      );
    }
  }

  @Post('sign-up/step2')
  @ApiBody({ type: SignUpStepTwoDto })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 400, description: 'Step 1 not completed or invalid.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signUpStep2(
    @Body() signUpStepTwoDto: SignUpStepTwoDto,
    @Res() res: Response,
    @I18nLang() lang: string,
  ) {
    try {
      const user = await this.authService.findUserById(signUpStepTwoDto.userId);

      if (!user) {
        return res.status(400).json({
          error: this.i18n.t('common.error.user_not_found', { lang }),
        });
      }

      // В зависимости от типа пользователя собираем соответствующие данные
      if (user.userType === UserType.REGULAR) {
        user.firstName = signUpStepTwoDto.firstName;
        user.lastName = signUpStepTwoDto.lastName;
        user.phoneNumber = signUpStepTwoDto.phoneNumber;
      } else if (user.userType === UserType.BUSINESS) {
        user.companyName = signUpStepTwoDto.companyName;
        user.registrationNumber = signUpStepTwoDto.registrationNumber;
      }

      await this.authService.saveUser(user);

      return res.status(201).json({
        success: this.i18n.t('common.success.user_registered', { lang }),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to complete step 2.',
        error,
      );
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
