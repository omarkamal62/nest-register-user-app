import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { StrongPassword } from '../../common/validators';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Name cannot be empty', groups: ['existence'] })
  @IsString({ message: 'Name must be a string', groups: ['existence'] })
  @MinLength(3, {
    message: 'Name must be at least 3 characters long',
    groups: ['format'],
  })
  readonly name: string;

  @IsNotEmpty({ message: 'Email cannot be empty', groups: ['existence'] })
  @IsEmail(
    {},
    { message: 'Please provide a valid email address', groups: ['format'] },
  )
  readonly email: string;

  @StrongPassword()
  readonly password: string;
}
