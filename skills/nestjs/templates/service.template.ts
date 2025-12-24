// Template for Service (Data Access Layer ONLY)
// Replace: {EntityName}, {entityName}
// 
// IMPORTANT: Services should ONLY contain database operations
// NO business logic, NO exception throwing

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { {EntityName} } from './entities/{entityName}.entity';

@Injectable()
export class {EntityName}Service {
  constructor(
    @InjectRepository({EntityName})
    private readonly repository: Repository<{EntityName}>,
  ) {}

  // === FIND OPERATIONS ===

  async findById(id: string): Promise<{EntityName} | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<{EntityName} | null> {
    return this.repository.findOne({ where: { name } });
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    where?: Partial<{EntityName}>;
  }): Promise<{ data: {EntityName}[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repository.findAndCount({
      where: options?.where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  // === MUTATION OPERATIONS ===

  async save(entity: {EntityName}): Promise<{EntityName}> {
    return this.repository.save(entity);
  }

  async softRemove(entity: {EntityName}): Promise<void> {
    await this.repository.softRemove(entity);
  }

  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  // === QUERY BUILDER (for complex queries) ===

  // async findWithRelations(id: string): Promise<{EntityName} | null> {
  //   return this.repository
  //     .createQueryBuilder('entity')
  //     .leftJoinAndSelect('entity.relation', 'relation')
  //     .where('entity.id = :id', { id })
  //     .getOne();
  // }
}
