// Template for TypeORM Entity
// Replace: {EntityName}, {table_name}
// IMPORTANT: Do NOT add @Index() unless explicitly requested

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('{table_name}')
export class {EntityName} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === Required String Column ===
  // @Column({ type: 'varchar', length: 255 })
  // name: string;

  // === Optional String Column ===
  // @Column({ type: 'varchar', length: 100, nullable: true })
  // description: string;

  // === Boolean with Default ===
  // @Column({ name: 'is_active', type: 'boolean', default: true })
  // isActive: boolean;

  // === Number Column ===
  // @Column({ type: 'float', nullable: true })
  // amount: number;

  // === Enum Column ===
  // @Column({
  //   name: 'status',
  //   type: 'enum',
  //   enum: StatusEnum,
  //   default: StatusEnum.ACTIVE,
  // })
  // status: StatusEnum;

  // === Foreign Key (UUID) ===
  // @Column({ name: 'parent_id', type: 'uuid' })
  // parentId: string;

  // === Timestamps ===
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  // === Relations ===

  // ManyToOne (this entity has foreign key)
  // @ManyToOne(() => ParentEntity)
  // @JoinColumn({ name: 'parent_id' })
  // parent: ParentEntity;

  // OneToMany (other entity has foreign key to this)
  // @OneToMany(() => ChildEntity, (child) => child.parent)
  // children: ChildEntity[];
}
