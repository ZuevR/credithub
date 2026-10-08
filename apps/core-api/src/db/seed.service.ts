import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { calcAnnuityPayment, type LoanTerms } from '@credithub/shared-types';
import { Client, Credit, Installment, Payment, Program } from './entities';

/**
 * Демо-данные для локальной разработки.
 *
 * Загрузка **идемпотентна**: если клиенты уже есть, метод ничего не делает.
 * Иначе повторный запуск плодил бы дубли, а команду легко нажать дважды.
 *
 * Суммы считает общий `calcAnnuityPayment` из `libs/shared-types` - тот же,
 * что использует Angular-калькулятор. Дублировать формулу нельзя: seed и UI
 * разошлись бы в копейках, и это выглядело бы как ошибка округления.
 */

/** Сумма в копейках из рублей. */
const rub = (amount: number): string => String(Math.round(amount * 100));

interface CreditSeed {
  id: string;
  type: 'annuity' | 'mortgage' | 'card';
  title: string;
  principal: number;
  annualRatePercent: number;
  termMonths: number;
  issuedAt: string;
  /** Сколько первых платежей по графику считается внесёнными. */
  paidInstallments: number;
  /** Возобновляемый кредит: фиксированного месячного платежа нет. */
  revolving?: boolean;
  programId?: string;
}

const CLIENT = {
  id: '99999999-9999-4999-8999-999999999999',
  fullName: 'Иванов Иван Иванович',
};

const PROGRAMS: Array<{
  id: string;
  type: 'annuity' | 'mortgage' | 'card';
  title: string;
  description: string;
  ratePercent: number;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
}> = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    type: 'annuity',
    title: 'Автокредит',
    description:
      'Кредит на новый или подержанный автомобиль. Ставка фиксированная на весь срок.',
    ratePercent: 14.5,
    minAmount: 300_000,
    maxAmount: 6_000_000,
    minTermMonths: 12,
    maxTermMonths: 84,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    type: 'mortgage',
    title: 'Ипотека',
    description:
      'Ипотека на готовое жильё и новостройки. Первоначальный взнос от 15%.',
    ratePercent: 9.2,
    minAmount: 1_000_000,
    maxAmount: 30_000_000,
    minTermMonths: 60,
    maxTermMonths: 360,
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    type: 'card',
    title: 'Кредитная карта',
    description:
      'Возобновляемая кредитная линия с льготным периодом. Платёж по графику не фиксирован.',
    ratePercent: 24.9,
    minAmount: 10_000,
    maxAmount: 1_000_000,
    minTermMonths: 12,
    maxTermMonths: 36,
  },
];

const CREDITS: CreditSeed[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'annuity',
    title: 'Автокредит',
    principal: 1_250_000,
    annualRatePercent: 14.5,
    termMonths: 60,
    issuedAt: '2026-03-01',
    paidInstallments: 12,
    programId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'mortgage',
    title: 'Ипотека',
    principal: 4_800_000,
    annualRatePercent: 9.2,
    termMonths: 240,
    issuedAt: '2025-11-15',
    paidInstallments: 24,
    programId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'card',
    title: 'Кредитная карта',
    principal: 150_000,
    annualRatePercent: 24.9,
    termMonths: 12,
    issuedAt: '2026-01-20',
    paidInstallments: 6,
    revolving: true,
  },
];

/** Первое число месяца через `monthOffset` месяцев от `issuedAt`. */
function installmentDate(issuedAt: string, monthOffset: number): string {
  const date = new Date(`${issuedAt}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + monthOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Разбивает аннуитет на график платежей.
 *
 * Общий `calcAnnuityPayment` даёт размер платежа, но не разложение на тело и
 * проценты - для графика оно нужно построчно.
 */
function buildSchedule(seed: CreditSeed): Array<{
  sequence: number;
  dueAt: string;
  amountMinor: string;
  principalMinor: string;
  interestMinor: string;
  remainingMinor: string;
  status: 'planned' | 'paid';
}> {
  const terms: LoanTerms = {
    principal: seed.principal,
    annualRatePercent: seed.annualRatePercent,
    termMonths: seed.termMonths,
  };
  const payment = calcAnnuityPayment(terms);
  if (!payment) throw new Error(`Не удалось посчитать график: ${seed.title}`);

  const monthlyPayment = payment.monthlyPayment;
  const monthlyRate = seed.annualRatePercent / 100 / 12;
  let remaining = seed.principal;

  return Array.from({ length: seed.termMonths }, (_, index) => {
    const sequence = index + 1;
    const interest = remaining * monthlyRate;
    // Последний платёж закрывает остаток: из-за округления он отличается от
    // остальных, и без этого долг никогда не обнулился бы.
    const principalPart =
      sequence === seed.termMonths ? remaining : monthlyPayment - interest;
    remaining = Math.max(0, remaining - principalPart);

    return {
      sequence,
      dueAt: installmentDate(seed.issuedAt, sequence),
      amountMinor: rub(monthlyPayment),
      principalMinor: rub(principalPart),
      interestMinor: rub(interest),
      remainingMinor: rub(remaining),
      status: sequence <= seed.paidInstallments ? 'paid' : 'planned',
    };
  });
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @returns true, если данные загружены; false - если уже были. */
  async run(): Promise<boolean> {
    if ((await this.dataSource.getRepository(Client).count()) > 0) {
      this.logger.log('клиенты уже есть — пропускаю');
      return false;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        Program,
        PROGRAMS.map((program) => ({
          id: program.id,
          type: program.type,
          title: program.title,
          description: program.description,
          ratePercent: program.ratePercent.toFixed(2),
          minAmountMinor: rub(program.minAmount),
          maxAmountMinor: rub(program.maxAmount),
          minTermMonths: program.minTermMonths,
          maxTermMonths: program.maxTermMonths,
          currency: 'RUB',
          published: true,
        }))
      );

      await manager.save(Client, { ...CLIENT, status: 'active' });

      for (const seedCredit of CREDITS) {
        const schedule = buildSchedule(seedCredit);
        const monthlyPayment = seedCredit.revolving
          ? null
          : schedule[0]?.amountMinor ?? null;

        await manager.save(Credit, {
          id: seedCredit.id,
          clientId: CLIENT.id,
          programId: seedCredit.programId ?? null,
          type: seedCredit.type,
          title: seedCredit.title,
          status: 'active',
          currency: 'RUB',
          principalMinor: rub(seedCredit.principal),
          annualRatePercent: seedCredit.annualRatePercent.toFixed(2),
          termMonths: seedCredit.termMonths,
          monthlyPaymentMinor: monthlyPayment,
          issuedAt: seedCredit.issuedAt,
        });

        await manager.save(
          Installment,
          schedule.map((row) => ({ ...row, creditId: seedCredit.id }))
        );

        // Внесённым платежам заводим факт оплаты: без него «оплачено»
        // считалось бы по статусу графика, а не по деньгам.
        const paidRows = schedule.filter((row) => row.status === 'paid');
        if (paidRows.length > 0) {
          const installments = await manager.find(Installment, {
            where: { creditId: seedCredit.id },
          });
          await manager.save(
            Payment,
            paidRows.map((row) => ({
              installmentId: installments.find(
                (item) => item.sequence === row.sequence
              )!.id,
              creditId: seedCredit.id,
              amountMinor: row.amountMinor,
              paidAt: new Date(`${row.dueAt}T10:00:00Z`),
            }))
          );
        }

        this.logger.log(
          `${seedCredit.title}: ${schedule.length} платежей, внесено ` +
            `${seedCredit.paidInstallments}`
        );
      }
    });

    return true;
  }
}
