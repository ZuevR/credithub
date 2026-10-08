import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

/** Значение по умолчанию совпадает с .env.example. */
const DEFAULT_CORE_API_URL = 'http://localhost:3001';

/** Дольше ждать смысла нет: пользовательский запрос не должен висеть минуту. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * HTTP-клиент к core-api.
 *
 * Граница сервисов настоящая: BFF не ходит в базу данных напрямую, а
 * спрашивает доменный сервис по HTTP. Иначе разделение BFF/core-api было бы
 * декоративным, и «выделить микросервис позже» превратилось бы в переписывание.
 *
 * Ошибки транспорта превращаются в осмысленные HTTP-статусы: недоступный
 * core-api - это `502 Bad Gateway`, а не `500` и не зависший запрос.
 */
@Injectable()
export class CoreApiClient {
  private readonly logger = new Logger(CoreApiClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('CORE_API_URL') ?? DEFAULT_CORE_API_URL
    ).replace(/\/$/, '');
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await axios.get<T>(url, {
        timeout: REQUEST_TIMEOUT_MS,
        // Свой разбор ошибок ниже: со стандартным `validateStatus` axios
        // выбрасывает исключение и прячет тело ответа core-api, а оно важно
        // для проброса 404.
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      // Пробрасываем статус core-api как есть: 404 должен остаться 404, иначе
      // клиент не отличит «нет данных» от «сервис сломался».
      throw new HttpException(
        response.data ?? { message: 'Ошибка core-api' },
        response.status
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const axiosError = error as AxiosError;
      this.logger.error(
        `core-api недоступен (${url}): ${axiosError.message}`,
        axiosError.stack
      );
      throw new HttpException(
        { message: 'Доменный сервис временно недоступен' },
        HttpStatus.BAD_GATEWAY
      );
    }
  }
}
