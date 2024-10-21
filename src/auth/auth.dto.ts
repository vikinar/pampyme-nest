import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length, Matches } from 'class-validator';

export class SignUpDto {
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
