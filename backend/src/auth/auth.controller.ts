import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('account-status')
  async accountStatus(@Body() body: { phone: string }) {
    return this.authService.getAccountStatus(body.phone);
  }

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
      societyId: string;
    },
  ) {
    return this.authService.register(
      body.phone,
      body.password,
      body.role,
      body.name,
      body.email,
      body.flatNo,
      body.societyId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password/request')
  async requestPasswordReset(@Body() body: { phone: string }) {
    return this.authService.requestPasswordReset(body.phone);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password/reset')
  async resetPassword(
    @Body()
    body: {
      phone: string;
      otp: string;
      newPassword: string;
    },
  ) {
    return this.authService.resetPassword(
      body.phone,
      body.otp,
      body.newPassword,
    );
  }
}
