import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  calcAnnuityPayment,
  toLoanTerms,
  type CreditDto,
  type LoanTerms,
} from '@credithub/shared-types';

/**
 * Демонстрационные кредиты того же контракта, что будет отдавать BFF на шаге 4.
 * Нужны, чтобы калькулятор можно было заполнить условиями реального кредита,
 * а не только вводить числа руками: так общий тип используется в рантайме,
 * а не остаётся подписью в импорте.
 */
const DEMO_CREDITS: CreditDto[] = [
  {
    id: 'car',
    type: 'annuity',
    title: 'Автокредит',
    status: 'active',
    currency: 'RUB',
    principal: { minorUnits: 125_000_000 },
    annualRatePercent: 14.5,
    termMonths: 60,
    monthlyPayment: null,
    issuedAt: '2026-03-01',
    paidInstallments: 0,
    nextPaymentAt: null,
  },
  {
    id: 'mortgage',
    type: 'mortgage',
    title: 'Ипотека',
    status: 'active',
    currency: 'RUB',
    principal: { minorUnits: 480_000_000 },
    annualRatePercent: 9.2,
    termMonths: 240,
    monthlyPayment: null,
    issuedAt: '2025-11-15',
    paidInstallments: 0,
    nextPaymentAt: null,
  },
  {
    id: 'card',
    type: 'card',
    title: 'Кредитная карта',
    status: 'active',
    currency: 'RUB',
    principal: { minorUnits: 15_000_000 },
    annualRatePercent: 24.9,
    termMonths: 12,
    monthlyPayment: null,
    issuedAt: '2026-01-20',
    paidInstallments: 0,
    nextPaymentAt: null,
  },
];

/**
 * Loan payment calculator - the real content of this remote, replacing Nx's
 * template component.
 *
 * Расчёт берётся из `@credithub/shared-types`: одна формула на React и Angular,
 * иначе округление разошлось бы между экранами.
 *
 * Тема наследуется от хоста: shell объявляет токены как CSS-переменные
 * (--ch-*), здесь используются только они.
 */
@Component({
  selector: 'ch-calculator',
  imports: [FormsModule],
  template: `
    <section class="card">
      <h2 class="title">Калькулятор платежа</h2>
      <p class="subtitle">Аннуитетный платёж по кредиту</p>

      <div class="presets">
        <span class="presets-label">Подставить кредит:</span>
        @for (credit of credits; track credit.id) {
          <button type="button" class="preset" (click)="applyCredit(credit)">
            {{ credit.title }}
          </button>
        }
      </div>

      <label class="field">
        <span>Сумма кредита, ₽</span>
        <input type="number" min="0" step="10000" [(ngModel)]="amount" name="amount" />
      </label>

      <label class="field">
        <span>Срок, мес.</span>
        <input type="number" min="1" step="1" [(ngModel)]="months" name="months" />
      </label>

      <label class="field">
        <span>Ставка, % годовых</span>
        <input type="number" min="0" step="0.1" [(ngModel)]="rate" name="rate" />
      </label>

      <div class="result">
        <span class="result-label">Платёж в месяц</span>
        <strong class="result-value">{{ monthlyPayment() }} ₽</strong>
      </div>
    </section>
  `,
  styles: [
    `
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--ch-spacing-sm);
        max-width: 420px;
        padding: var(--ch-spacing-md);
        border: 1px solid var(--ch-color-text-disabled);
        border-radius: var(--ch-shape-radius);
        background: var(--ch-color-surface-default);
        color: var(--ch-color-text-primary);
      }
      .title {
        margin: 0;
        font-size: var(--ch-font-size-h2);
        font-weight: var(--ch-font-weight-h2);
      }
      .subtitle {
        margin: 0 0 var(--ch-spacing-sm);
        color: var(--ch-color-text-secondary);
        font-size: var(--ch-font-size-body);
      }
      .presets {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ch-spacing-xs);
      }
      .presets-label {
        color: var(--ch-color-text-secondary);
        font-size: var(--ch-font-size-caption);
      }
      .preset {
        padding: var(--ch-spacing-xs) var(--ch-spacing-sm);
        border: 1px solid var(--ch-color-primary-main);
        border-radius: var(--ch-spacing-xs);
        background: transparent;
        color: var(--ch-color-primary-main);
        font: inherit;
        font-size: var(--ch-font-size-caption);
        cursor: pointer;
      }
      .preset:hover {
        background: var(--ch-color-primary-main);
        color: var(--ch-color-primary-contrast);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--ch-font-size-body);
      }
      .field input {
        padding: var(--ch-spacing-xs) var(--ch-spacing-sm);
        border: 1px solid var(--ch-color-text-disabled);
        border-radius: var(--ch-spacing-xs);
        font: inherit;
        color: inherit;
      }
      .result {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--ch-spacing-sm);
        margin-top: var(--ch-spacing-sm);
        padding-top: var(--ch-spacing-sm);
        border-top: 1px solid var(--ch-color-surface-muted);
      }
      .result-label {
        color: var(--ch-color-text-secondary);
        font-size: var(--ch-font-size-caption);
      }
      .result-value {
        font-size: var(--ch-font-size-h3);
        font-weight: var(--ch-font-weight-h3);
      }
    `,
  ],
})
export class Calculator {
  readonly credits = DEMO_CREDITS;

  amount = signal(1_000_000);
  months = signal(60);
  rate = signal(12);

  private terms = computed<LoanTerms>(() => ({
    principal: Number(this.amount()) || 0,
    termMonths: Number(this.months()) || 0,
    annualRatePercent: Number(this.rate()) || 0,
  }));

  monthlyPayment = computed(() => {
    const payment = calcAnnuityPayment(this.terms());
    // Общий расчёт отдаёт дробные рубли; округляем только для показа.
    return payment ? Math.round(payment.monthlyPayment).toLocaleString('ru-RU') : '—';
  });

  /** Заполняет поля условиями кредита - тот же LoanTerms, что понимает расчёт. */
  applyCredit(credit: CreditDto) {
    const terms = toLoanTerms(credit);
    this.amount.set(terms.principal);
    this.rate.set(terms.annualRatePercent);
    this.months.set(terms.termMonths);
  }
}

export default Calculator;
