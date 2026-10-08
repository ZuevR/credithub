import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Credit } from './credit';

/** Статус клиента в банке. */
export type ClientStatus = 'active' | 'blocked';

/**
 * Клиент банка - владелец кредитов.
 *
 * Хранит только то, что нужно текущему UI (портфель кредитов и обращение по
 * имени). Персональные данные вроде паспорта здесь намеренно не заводятся:
 * это отдельный разговор про хранение PII, и он не входит в текущий шаг.
 */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ClientStatus;

  @OneToMany(() => Credit, (credit) => credit.client)
  credits!: Credit[];
}
