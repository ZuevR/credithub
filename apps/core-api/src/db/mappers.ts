import type {
  CreditDto,
  CreditStatus,
  CreditType,
  CurrencyCode,
  PortfolioSummaryDto,
  ProgramDto,
} from '@credithub/shared-types';
import type { Credit } from './entities/credit';
import type { Program } from './entities/program';

/**
 * Преобразование сущностей БД в публичный контракт API (`libs/shared-types`).
 *
 * Вынесено отдельно от сервисов: маппинг - единственное место, где типы БД
 * (`bigint`-строки, `numeric`-строки) превращаются в числа контракта. Если
 * размазать это по сервисам, рано или поздно где-то забудут `Number()` и
 * клиент получит строку вместо суммы.
 */

/**
 * `bigint` и `numeric` приходят из `pg` строками - JavaScript теряет точность
 * выше 2^53. Для денег в копейках это безопасно: даже миллиард рублей - это
 * 10^11 копеек, на пять порядков меньше предела. Поэтому приводим к числу
 * осознанно, а не «потому что так короче».
 */
const toNumber = (value: string | number | null): number =>
  value === null ? 0 : Number(value);

/** Ставка из `numeric(5,2)`: строка '14.50' -> число 14.5. */
const toRate = (value: string | number): number => Number(value);

/** Названия полей не совпадают с контрактом, поэтому перечисляем явно. */
const CREDIT_TYPE: Record<string, CreditType> = {
  annuity: 'annuity',
  mortgage: 'mortgage',
  card: 'card',
};

const CREDIT_STATUS: Record<string, CreditStatus> = {
  active: 'active',
  closed: 'closed',
  overdue: 'overdue',
};

export interface CreditAggregates {
  paidInstallments: number;
  nextPaymentAt: string | null;
}

export function toCreditDto(
  credit: Credit,
  aggregates: CreditAggregates
): CreditDto {
  return {
    id: credit.id,
    type: CREDIT_TYPE[credit.type] ?? 'annuity',
    title: credit.title,
    status: CREDIT_STATUS[credit.status] ?? 'active',
    currency: credit.currency as CurrencyCode,
    principal: { minorUnits: toNumber(credit.principalMinor) },
    annualRatePercent: toRate(credit.annualRatePercent),
    termMonths: credit.termMonths,
    monthlyPayment:
      credit.monthlyPaymentMinor === null
        ? null
        : { minorUnits: toNumber(credit.monthlyPaymentMinor) },
    issuedAt: credit.issuedAt,
    paidInstallments: aggregates.paidInstallments,
    nextPaymentAt: aggregates.nextPaymentAt,
  };
}

export function toProgramDto(program: Program): ProgramDto {
  return {
    id: program.id,
    type: CREDIT_TYPE[program.type] ?? 'annuity',
    title: program.title,
    description: program.description,
    ratePercent: toRate(program.ratePercent),
    minAmount: { minorUnits: toNumber(program.minAmountMinor) },
    maxAmount: { minorUnits: toNumber(program.maxAmountMinor) },
    minTermMonths: program.minTermMonths,
    maxTermMonths: program.maxTermMonths,
    currency: program.currency as CurrencyCode,
  };
}

/** Сводка по портфелю: считается из тех же данных, что отдаёт `/credits`. */
export function toPortfolioSummary(
  credits: CreditDto[],
  paidLastMonthMinor: number,
  currency: CurrencyCode
): PortfolioSummaryDto {
  const active = credits.filter((credit) => credit.status === 'active');

  return {
    currency,
    totalDebt: {
      minorUnits: active.reduce(
        (sum, credit) => sum + credit.principal.minorUnits,
        0
      ),
    },
    totalMonthlyPayment: {
      minorUnits: active.reduce(
        (sum, credit) => sum + (credit.monthlyPayment?.minorUnits ?? 0),
        0
      ),
    },
    activeCredits: active.length,
    paidLastMonth: { minorUnits: paidLastMonthMinor },
  };
}
