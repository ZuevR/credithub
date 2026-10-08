import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Credit } from './credit';

/** Вид кредитной программы. */
export type ProgramType = 'annuity' | 'mortgage' | 'card';

/**
 * Кредитная программа - публичный каталог продуктов банка.
 *
 * Именно эти данные отдаёт SSR-раздел «Программы». Ставки хранятся как
 * `numeric` (а не float) по той же причине, что и в `Credit`, а границы сумм и
 * сроков - в минорных единицах и месяцах.
 */
@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: ProgramType;

  @Column({ type: 'varchar', length: 140 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  ratePercent!: string;

  @Column({ type: 'bigint' })
  minAmountMinor!: string;

  @Column({ type: 'bigint' })
  maxAmountMinor!: string;

  @Column({ type: 'int' })
  minTermMonths!: number;

  @Column({ type: 'int' })
  maxTermMonths!: number;

  @Column({ type: 'varchar', length: 3, default: 'RUB' })
  currency!: string;

  /** Признак публикации: черновики не должны попадать в SSR-раздел. */
  @Index()
  @Column({ type: 'boolean', default: true })
  published!: boolean;

  @OneToMany(() => Credit, (credit) => credit.program)
  credits!: Credit[];
}
