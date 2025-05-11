import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create a plain JavaScript object from the Mongoose document
    const userObj = user.toObject() as {
      _id: { toString: () => string };
      email: string;
      password: string;
    };

    // Create the JWT payload
    const payload = {
      sub: userObj._id.toString(),
      email: userObj.email,
    };

    // Sign and return the JWT token
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
