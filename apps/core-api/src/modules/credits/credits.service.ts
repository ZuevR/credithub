import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreditDto, PortfolioSummaryDto } from '@credithub/shared-types';
import { Credit } from '../../db/entities/credit';
import { Installment } from '../../db/entities/installment';
import { Payment } from '../../db/entities/payment';
import {
  toCreditDto,
  toPortfolioSummary,
  type CreditAggregates,
} from '../../db/mappers';

/**
 * Один клиент-владелец портфеля в демо-данных.
 *
 * Пока авторизации нет (Keycloak - отдельный шаг), клиент определяется
 * константой. Когда появится аутентификация, этот идентификатор придёт из
 * токена, а форма запроса к сервису не изменится.
 */
const DEMO_CLIENT_ID = '99999999-9999-4999-8999-999999999999';

/** Сколько внесено за последние 30 дней - окно для сводки. */
const PAID_WINDOW_DAYS = 30;

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(Credit)
    private readonly credits: Repository<Credit>,
    @InjectRepository(Installment)
    private readonly installments: Repository<Installment>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>
  ) {}

  async findAll(): Promise<CreditDto[]> {
    const credits = await this.credits.find({
      where: { clientId: DEMO_CLIENT_ID },
      order: { issuedAt: 'ASC' },
    });
    const aggregates = await this.aggregatesByCredit(
      credits.map((credit) => credit.id)
    );

    return credits.map((credit) =>
      toCreditDto(credit, aggregates.get(credit.id) ?? EMPTY_AGGREGATES)
    );
  }

  async findOne(id: string): Promise<CreditDto | null> {
    const credit = await this.credits.findOne({
      where: { id, clientId: DEMO_CLIENT_ID },
    });
    if (!credit) return null;

    const aggregates = await this.aggregatesByCredit([credit.id]);
    return toCreditDto(credit, aggregates.get(credit.id) ?? EMPTY_AGGREGATES);
  }

  /**
   * Агрегаты для экрана «Обзор».
   *
   * Считаются из того же набора кредитов, что отдаёт `findAll`, а не отдельным
   * SQL: иначе появился бы второй способ считать «активные кредиты», и значения
   * на обзоре и на странице кредитов могли бы разойтись.
   */
  async portfolioSummary(): Promise<PortfolioSummaryDto> {
    const credits = await this.findAll();
    const paidMinor = await this.paidWithinWindow();

    return toPortfolioSummary(
      credits,
      paidMinor,
      credits[0]?.currency ?? 'RUB'
    );
  }

  /** Внесено за последние 30 дней - сумма фактических платежей, не статусов. */
  async paidWithinWindow(): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - PAID_WINDOW_DAYS);

    const row = await this.payments
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amountMinor), 0)', 'total')
      .where('payment.paidAt >= :since', { since })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  /**
   * Внесённые платежи и дата ближайшего невнесённого - по каждому кредиту.
   *
   * Отдельным запросом, а не через `relations` при загрузке кредитов: для
   * графика в 240 платежей жадная загрузка тянет из базы заметно больше
   * данных, чем нужно экрану, ради двух чисел.
   */
  private async aggregatesByCredit(
    creditIds: string[]
  ): Promise<Map<string, CreditAggregates>> {
    const result = new Map<string, CreditAggregates>();
    if (creditIds.length === 0) return result;

    const paid = await this.installments
      .createQueryBuilder('installment')
      .select('installment.creditId', 'creditId')
      .addSelect('COUNT(*)', 'paidCount')
      .where('installment.creditId IN (:...creditIds)', { creditIds })
      .andWhere('installment.status = :status', { status: 'paid' })
      .groupBy('installment.creditId')
      .getRawMany<{ creditId: string; paidCount: string }>();

    const next = await this.installments
      .createQueryBuilder('installment')
      .select('installment.creditId', 'creditId')
      .addSelect('MIN(installment.dueAt)', 'nextDueAt')
      .where('installment.creditId IN (:...creditIds)', { creditIds })
      .andWhere('installment.status != :status', { status: 'paid' })
      .groupBy('installment.creditId')
      .getRawMany<{ creditId: string; nextDueAt: string | Date }>();

    for (const id of creditIds) {
      result.set(id, { paidInstallments: 0, nextPaymentAt: null });
    }
    for (const row of paid) {
      const current = result.get(row.creditId) ?? EMPTY_AGGREGATES;
      result.set(row.creditId, {
        ...current,
        paidInstallments: Number(row.paidCount),
      });
    }
    for (const row of next) {
      const current = result.get(row.creditId) ?? EMPTY_AGGREGATES;
      result.set(row.creditId, {
        ...current,
        nextPaymentAt: toIsoDate(row.nextDueAt),
      });
    }

    return result;
  }
}

/**
 * Приводит значение колонки `date` к строке `YYYY-MM-DD`.
 *
 * `date` приходит то строкой, то `Date` - это зависит от драйвера и от того,
 * как запрос собрал строку. Использовать `toISOString()` здесь НЕЛЬЗЯ: `Date`
 * для колонки `date` означает полночь по ЛОКАЛЬНОМУ времени, а `toISOString()`
 * переводит в UTC и в отрицательных зонах отматывает день назад. Именно так
 * `2027-12-15` из базы превращалось в `2027-12-14` в API (проверено).
 */
function toIsoDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

const EMPTY_AGGREGATES: CreditAggregates = {
  paidInstallments: 0,
  nextPaymentAt: null,
};
