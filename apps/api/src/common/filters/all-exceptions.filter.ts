import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';
import { SUPABASE_ADMIN } from '../supabase.module';

/**
 * Filtro global de excepciones.
 * Captura todos los errores y devuelve mensajes claros para el usuario.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  async catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Loguear el error con stack trace
    const errorMessage = exception?.message ?? 'Error desconocido';
    const errorStack = exception?.stack ?? '';
    this.logger.error(`[${request.method} ${request.url}] ${errorMessage}\n${errorStack}`);

    // Determinar status code y mensaje amigable
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error inesperado. Por favor intenta de nuevo.';
    let details: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();

      // Si es un objeto, extraer message y agregar detalles
      if (typeof resp === 'object' && resp !== null) {
        const obj = resp as any;
        message = obj.message || exception.message;
        details = { ...obj };
        if (details) {
          delete details.message;
          delete details.statusCode;
          delete details.error;
        }
      } else {
        message = exception.message || message;
      }
    } else if (exception?.code && typeof exception.code === 'string') {
      // Errores de Supabase/Postgres
      const dbInfo = this.parseSupabaseError(exception);
      status = dbInfo.status;
      message = dbInfo.message;
      details = dbInfo.details;
    } else if (exception?.message) {
      // Errores genéricos con mensaje
      message = this.friendlyMessage(exception.message);
    }

    // Si el user está autenticado, intentar loguear el error en notifications
    const user = (request as any).user;
    if (user?.id && status >= 500) {
      this.logErrorToDB(user.id, request.url, errorMessage).catch(() => {});
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: this.getErrorName(status),
      ...(details && { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Interpretar errores comunes de Postgres/Supabase.
   */
  private parseSupabaseError(err: any): {
    status: number;
    message: string;
    details: Record<string, any>;
  } {
    const code = err.code;
    const details: Record<string, any> = {
      pgCode: code,
      pgHint: err.hint,
      pgDetail: err.details,
    };

    switch (code) {
      case '23505': // unique_violation
        return {
          status: HttpStatus.CONFLICT,
          message: `Ya existe un registro con esos datos: ${err.message}`,
          details,
        };
      case '23503': // foreign_key_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `No se puede realizar la operación: referencia a un registro que no existe.`,
          details,
        };
      case '23502': // not_null_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Faltan datos requeridos: ${err.message}`,
          details,
        };
      case '23514': // check_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Los datos no cumplen las reglas: ${err.message}`,
          details,
        };
      case 'PGRST116': // No rows found
        return {
          status: HttpStatus.NOT_FOUND,
          message: `No se encontró el recurso solicitado`,
          details,
        };
      case 'P0001': // raise_exception
      case 'P0002': // raise_exception (custom error)
        // Mensajes de nuestras funciones PL/SQL
        return {
          status: HttpStatus.BAD_REQUEST,
          message: err.message || 'Operación no permitida',
          details,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: err.message || 'Error de base de datos',
          details,
        };
    }
  }

  /**
   * Convertir mensaje técnico a mensaje amigable.
   */
  private friendlyMessage(msg: string): string {
    const friendlyMap: Record<string, string> = {
      ECONNREFUSED: 'No se pudo conectar al servidor. Verifica tu conexión.',
      ETIMEDOUT: 'La conexión tardó demasiado. Intenta de nuevo.',
      'Network request failed': 'Sin conexión a internet. Verifica tu red.',
    };

    for (const [key, value] of Object.entries(friendlyMap)) {
      if (msg.includes(key)) return value;
    }

    return msg;
  }

  private getErrorName(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    return map[status] ?? 'Error';
  }

  private async logErrorToDB(userId: string, url: string, errorMessage: string) {
    try {
      await this.admin.from('notifications').insert({
        user_id: userId,
        type: 'system_error',
        title: 'Error en el sistema',
        message: `Error en ${url}: ${errorMessage}`,
        payload: { url, error: errorMessage },
      });
    } catch {
      // Silently fail
    }
  }
}
