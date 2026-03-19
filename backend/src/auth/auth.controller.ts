import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: { phone: string; password: string }) {
    return this.authService.login(body.phone, body.password);
  }

  @Post('register')
  async register(
    @Body()
    body: {
      phone: string;
      password: string;
      role: string;
      name: string;
      email: string;
      flatNo: string;
    },
  ) {
    return this.authService.register(
      body.phone,
      body.password,
      body.role,
      body.name,
      body.email,
      body.flatNo,
    );
  }
}
