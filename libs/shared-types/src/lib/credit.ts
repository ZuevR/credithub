import type { LoanTerms } from './calculator';

/** Какие виды кредитов бывают в домене. */
export type CreditType = 'annuity' | 'mortgage' | 'card';

/** Код валюты. Пока только рубль, но поле существует, чтобы не хардкодить его в UI. */
export type CurrencyCode = 'RUB';

/** Состояние кредита. */
export type CreditStatus = 'active' | 'closed' | 'overdue';

/**
 * Денежная сумма.
 *
 * Хранится в минорных единицах (копейках), как это делают API: целое число
 * исключает ошибки округления, которые неизбежны при работе с дробными
 * рублями. Форматирование в "1 250 000 ₽" - задача UI, а не модели данных.
 *
 * Валюты здесь намеренно НЕТ: в одной записи она одна, поэтому дублировать её
 * в каждой сумме - лишний шум. Валюта живёт на уровне сущности (`CreditDto`),
 * и так же устроена схема БД.
 */
export interface Money {
  minorUnits: number;
}

/**
 * Кредит так, как его отдаёт API.
 *
 * Контракт выведен из реальной схемы БД (`apps/core-api`), а не из UI: поля
 * названы как в сущности, деньги - в минорных единицах, ставки - числами.
 * Преобразование в «1 250 000 ₽» и «14,5%» остаётся задачей UI.
 */
export interface CreditDto {
  id: string;
  type: CreditType;
  title: string;
  status: CreditStatus;
  currency: CurrencyCode;
  principal: Money;
  /** Годовая ставка в процентах: 14.5 = 14,5% годовых. */
  annualRatePercent: number;
  termMonths: number;
  /** Платёж в месяц; null для возобновляемых кредитов вроде карты. */
  monthlyPayment: Money | null;
  /** Дата выдачи в формате ISO-8601: '2026-03-01'. */
  issuedAt: string;
  /** Сколько платежей по графику уже внесено. */
  paidInstallments: number;
  /** Дата ближайшего невнесённого платежа; null, если график закрыт. */
  nextPaymentAt: string | null;
}

/**
 * Агрегаты для экрана «Обзор»: считаются на сервере, чтобы клиент не тянул
 * весь портфель ради трёх чисел.
 */
export interface PortfolioSummaryDto {
  currency: CurrencyCode;
  totalDebt: Money;
  totalMonthlyPayment: Money;
  activeCredits: number;
  /** Сколько внесено за последние 30 дней. */
  paidLastMonth: Money;
}

/** Кредитная программа - публичный каталог продуктов. */
export interface ProgramDto {
  id: string;
  type: CreditType;
  title: string;
  description: string;
  ratePercent: number;
  minAmount: Money;
  maxAmount: Money;
  minTermMonths: number;
  maxTermMonths: number;
  currency: CurrencyCode;
}

/**
 * Кредит в виде, пригодном для расчёта: те же три числа, что принимает
 * калькулятор. Позволяет передать кредит в калькулятор без ручного переноса
 * полей и без знания о деньгах и форматировании.
 */
export function toLoanTerms(credit: CreditDto): LoanTerms {
  return {
    principal: credit.principal.minorUnits / 100,
    annualRatePercent: credit.annualRatePercent,
    termMonths: credit.termMonths,
  };
}
