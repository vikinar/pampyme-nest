import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service'; // Импортируем PrismaService
import * as bcrypt from 'bcrypt';
import { SignUpStepOneDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    readonly jwtService: JwtService,
    private readonly prisma: PrismaService, // Внедряем PrismaService
  ) {}

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateAccessToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }

  generateRefreshToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION,
      },
    );
  }

  async createUserWithEmailAndPassword(signUpStepOneDto: SignUpStepOneDto) {
    const { email, password, userType, businessType } = signUpStepOneDto;

    // Проверка на существующего пользователя
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание нового пользователя
    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        userType: userType,
        businessType: userType === 'BUSINESS' ? businessType : null,
      },
    });

    return newUser;
  }

  // Метод для сохранения пользователя (если потребуется обновление после добавления данных)
  async saveUser(user: any) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: user,
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
