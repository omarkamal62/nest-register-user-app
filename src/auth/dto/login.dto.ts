import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { groups: ['existence', 'format'], message: 'Invalid email' })
  @IsNotEmpty({ groups: ['existence'], message: 'Email cannot be empty' })
  email: string;

  @IsString({ groups: ['existence'], message: 'Password must be a string' })
  @IsNotEmpty({ groups: ['existence'], message: 'Password cannot be empty' })
  password: string;
}
