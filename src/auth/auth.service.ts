import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service'; // Импортируем PrismaService
import * as bcrypt from 'bcrypt';

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

  // Создаём пользователя в базе данных
  async createUser({ email, password }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        isVerified: false, // Если требуется, можно сразу добавить логику верификации
      },
    });
  }

  // Находим пользователя по email
  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
