import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { UserType, BusinessType } from '@prisma/client';

export { UserType, BusinessType };

export class SignUpStepOneDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'StrongPassword123!', description: 'User password' })
  @IsNotEmpty({ message: 'Password is required' })
  @Length(6, 20, { message: 'Password must be 8-20 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*\d).+$/, {
    message:
      'Password must contain at least one lowercase letter and one number',
  })
  password: string;

  @ApiProperty({
    example: `regular || business`,
  })
  @IsEnum(UserType)
  userType: UserType;

  @ApiPropertyOptional({
    example: `company || professional`,
  })
  @IsEnum(BusinessType)
  @IsOptional()
  businessType?: BusinessType;
}

export class SignUpStepTwoDto {
  @IsUUID()
  userId: string;

  // Для обычных пользователей
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  // Для бизнес-пользователей (если userType === 'business')
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;
}

export class SignInDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({ example: 'StrongPassword123!', description: 'User password' })
  password: string;
}
