import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('booklist_items')
export class BooklistItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'booklist_id', type: 'bigint', unsigned: true })
  booklistId: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId: string;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ length: 255, default: '' })
  note: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}