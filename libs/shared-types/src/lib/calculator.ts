/**
 * Условия кредита, с которыми работает расчёт.
 *
 * Это общий вход для калькулятора: его используют и React-MFE (подставляя
 * условия реального кредита), и Angular-MFE (считая платёж).
 */
export interface LoanTerms {
  /** Сумма кредита в рублях, не в копейках: 1 000 000 = миллион. */
  principal: number;
  /** Годовая ставка в процентах: 14.5 = 14,5% годовых. */
  annualRatePercent: number;
  /** Срок в месяцах. */
  termMonths: number;
}

/** Результат расчёта аннуитетного платежа. */
export interface LoanPayment {
  /** Платёж в месяц, рублей. */
  monthlyPayment: number;
  /** Всего к возврату за весь срок, рублей. */
  totalPaid: number;
  /** Переплата (totalPaid - principal), рублей. */
  totalInterest: number;
}

/**
 * Аннуитетный платёж - единственная реализация формулы на оба MFE.
 *
 * Дублировать её в React и Angular нельзя: расхождения в округлении дадут
 * разные суммы на двух экранах одного приложения.
 *
 * @returns null, если условий недостаточно для расчёта (нулевой срок).
 */
export function calcAnnuityPayment(terms: LoanTerms): LoanPayment | null {
  const { principal, annualRatePercent, termMonths } = terms;
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(termMonths) || termMonths <= 0) return null;
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) return null;

  const monthlyRate = annualRatePercent / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  const totalPaid = monthlyPayment * termMonths;

  return {
    monthlyPayment,
    totalPaid,
    totalInterest: totalPaid - principal,
  };
}
