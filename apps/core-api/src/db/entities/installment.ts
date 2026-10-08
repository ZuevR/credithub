import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Credit } from './credit';
import { Payment } from './payment';

/** Состояние платежа по графику. */
export type InstallmentStatus = 'planned' | 'paid' | 'overdue';

/**
 * Платёж по графику (аннуитет).
 *
 * Суммы - в минорных единицах, как и в `Credit` (см. комментарий там).
 * Уникальность `(creditId, sequence)` не даёт задвоить платёж в графике.
 */
@Entity('installments')
@Unique('uq_installment_credit_sequence', ['creditId', 'sequence'])
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @ManyToOne(() => Credit, (credit) => credit.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditId' })
  credit!: Credit;

  /** Номер платежа по порядку: 1..termMonths. */
  @Column({ type: 'int' })
  sequence!: number;

  @Column({ type: 'date' })
  dueAt!: string;

  @Column({ type: 'bigint' })
  amountMinor!: string;

  /** Часть платежа, ушедшая в тело долга. */
  @Column({ type: 'bigint' })
  principalMinor!: string;

  /** Часть платежа, ушедшая в проценты. */
  @Column({ type: 'bigint' })
  interestMinor!: string;

  /** Остаток долга после этого платежа. */
  @Column({ type: 'bigint' })
  remainingMinor!: string;

  @Column({ type: 'varchar', length: 16, default: 'planned' })
  status!: InstallmentStatus;

  @OneToMany(() => Payment, (payment) => payment.installment)
  payments!: Payment[];
}
