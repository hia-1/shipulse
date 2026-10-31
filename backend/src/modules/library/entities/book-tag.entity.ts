import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Book } from './book.entity';
import { Tag } from './tag.entity';

@Entity('book_tags')
export class BookTag {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId: string;

  @Column({ name: 'tag_id', type: 'bigint', unsigned: true })
  tagId: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @ManyToOne(() => Book)
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @ManyToOne(() => Tag)
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;
}