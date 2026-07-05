import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    const { data, error } = await this.resend.emails.send({
      from: 'POS Pyme <onboarding@resend.dev>',
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (error) {
      console.error('Error enviando email:', error);
      throw error;
    }

    return data;
  }

  async sendShiftClosedEmail(
    to: string,
    workerName: string,
    totalSales: number,
    discrepancy: number,
  ) {
    const status =
      Math.abs(discrepancy) <= 1000
        ? '✅ OK'
        : Math.abs(discrepancy) <= 3000
          ? '⚠️ ATENCIÓN'
          : '❌ CRÍTICO';

    return this.sendEmail({
      to,
      subject: `🔔 Turno cerrado - ${workerName}`,
      html: `
        <h2>Turno cerrado</h2>
        <p><strong>Trabajador:</strong> ${workerName}</p>
        <p><strong>Total ventas:</strong> $${totalSales.toLocaleString('es-CL')}</p>
        <p><strong>Descuadre:</strong> $${discrepancy.toLocaleString('es-CL')}</p>
        <p><strong>Estado:</strong> ${status}</p>
      `,
    });
  }

  async sendLowStockAlert(to: string, productName: string, currentStock: number, minStock: number) {
    return this.sendEmail({
      to,
      subject: `⚠️ Stock bajo - ${productName}`,
      html: `
        <h2>Alerta de stock bajo</h2>
        <p><strong>Producto:</strong> ${productName}</p>
        <p><strong>Stock actual:</strong> ${currentStock}</p>
        <p><strong>Stock mínimo:</strong> ${minStock}</p>
        <p>Por favor, reponga este producto.</p>
      `,
    });
  }
}
