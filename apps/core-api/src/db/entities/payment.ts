import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Credit } from './credit';
import { Installment } from './installment';

/**
 * Фактически внесённый платёж.
 *
 * Отдельная сущность, потому что по графику (`Installment`) платёж может быть
 * внесён частично или несколькими суммами. `creditId` продублирован намеренно:
 * он позволяет считать оплаченное по кредиту без обязательного join через
 * график, а `installmentId` при этом остаётся основным смыслом записи.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  installmentId!: string;

  @ManyToOne(() => Installment, (installment) => installment.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'installmentId' })
  installment!: Installment;

  @Index()
  @Column({ type: 'uuid' })
  creditId!: string;

  @ManyToOne(() => Credit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditId' })
  credit!: Credit;

  /** Внесённая сумма в минорных единицах (может быть меньше платежа по графику). */
  @Column({ type: 'bigint' })
  amountMinor!: string;

  @Column({ type: 'timestamptz' })
  paidAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
