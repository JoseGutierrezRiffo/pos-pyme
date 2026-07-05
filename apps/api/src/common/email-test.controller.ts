import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EmailService } from './email.service';

@Controller('test-email')
export class EmailTestController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Endpoint DEV-only para probar envío de emails.
   * Bloqueado en producción via NODE_ENV check.
   *
   * FIX-ISS-007: Antes este endpoint era @Public() y aceptaba HTML arbitrario
   * en `message`, lo que permitía phishing. Ahora:
   * - Solo accesible en development/test (no en production)
   * - El `message` se trata como texto plano (no HTML), se escapa
   */
  @Public()
  @Post('send')
  async sendTestEmail(@Body() body: { to: string; subject: string; message: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Endpoint deshabilitado en producción');
    }

    const { to, subject, message } = body || {};

    if (!to || !subject || !message) {
      throw new BadRequestException('Faltan campos: to, subject, message');
    }

    // Escapar HTML básico para prevenir inyección
    const escapeHtml = (s: string): string =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    try {
      const result = await this.emailService.sendEmail({
        to,
        subject: escapeHtml(subject),
        text: message,
        html: `<p>${escapeHtml(message)}</p>`,
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}