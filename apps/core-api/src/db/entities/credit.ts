import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client';
import { Installment } from './installment';
import { Program } from './program';

/** Вид кредита. Публичный контракт - `CreditType` в `libs/shared-types`. */
export type CreditType = 'annuity' | 'mortgage' | 'card';

/** Состояние кредита. */
export type CreditStatus = 'active' | 'closed' | 'overdue';

/**
 * Выданный кредит.
 *
 * Денежные суммы хранятся в МИНОРНЫХ единицах (копейках) целым числом - так же,
 * как в публичном `CreditDto`. Это осознанный выбор: дробные рубли в
 * `numeric`/`float` дают ошибки округления при суммировании портфеля, а
 * конвертация "рубли <-> копейки" на каждом слое - источник расхождений.
 * Валюта хранится на уровне кредита: в одной записи она одна, дублировать её
 * в каждой сумме незачем.
 */
@Entity('credits')
export class Credit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => Client, (client) => client.credits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  /** Программы может не быть: кредит выдают и вне типовой программы. */
  @Column({ type: 'uuid', nullable: true })
  programId!: string | null;

  @ManyToOne(() => Program, (program) => program.credits, { nullable: true })
  @JoinColumn({ name: 'programId' })
  program!: Program | null;

  @Column({ type: 'varchar', length: 16 })
  type!: CreditType;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: CreditStatus;

  @Column({ type: 'varchar', length: 3, default: 'RUB' })
  currency!: string;

  /** Сумма кредита в минорных единицах (копейках). */
  @Column({ type: 'bigint' })
  principalMinor!: string;

  /**
   * Годовая ставка в процентах. `numeric(5,2)` - не `float`: ставка участвует
   * в денежных расчётах, и двоичное представление здесь ни к чему.
   */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  annualRatePercent!: string;

  @Column({ type: 'int' })
  termMonths!: number;

  /** Платёж в месяц в минорных единицах; null - возобновляемый кредит (карта). */
  @Column({ type: 'bigint', nullable: true })
  monthlyPaymentMinor!: string | null;

  @Column({ type: 'date' })
  issuedAt!: string;

  @OneToMany(() => Installment, (installment) => installment.credit)
  installments!: Installment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
