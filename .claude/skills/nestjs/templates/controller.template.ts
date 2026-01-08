// Template for Controller (Business Logic Layer)
// Replace: {EntityName}, {entityName}, {entity-name}
//
// IMPORTANT: Controllers handle ALL business logic
// Services are only for database access

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { {EntityName}Service } from './{entityName}.service';
import { {EntityName} } from './entities/{entityName}.entity';
import {
  Create{EntityName}Dto,
  Update{EntityName}Dto,
  List{EntityName}Dto,
} from './dto';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

@ApiTags('{entity-name}')
@Controller('api/v1/{entity-name}')
export class {EntityName}Controller {
  constructor(private readonly service: {EntityName}Service) {}

  // === CREATE ===
  @Post()
  @ApiOperation({ summary: 'Create a new {entityName}' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  @ApiResponse({ status: 409, description: 'Already exists' })
  async create(@Body() dto: Create{EntityName}Dto) {
    // Business logic: check for duplicates
    const existing = await this.service.findByName(dto.name);
    if (existing) {
      throw new ConflictException('{EntityName} with this name already exists');
    }

    // Create entity
    const entity = new {EntityName}();
    Object.assign(entity, dto);

    // Save and return
    const saved = await this.service.save(entity);
    return { data: saved };
  }

  // === READ ALL ===
  @Get()
  @ApiOperation({ summary: 'List all {entityName}s' })
  @ApiResponse({ status: 200, description: 'List retrieved' })
  async findAll(@Query() query: List{EntityName}Dto) {
    const { data, total } = await this.service.findAll({
      page: query.page,
      limit: query.limit,
    });

    return {
      data,
      total,
      page: query.page || 1,
      limit: query.limit || 20,
    };
  }

  // === READ ONE ===
  @Get(':id')
  @ApiOperation({ summary: 'Get {entityName} by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const entity = await this.service.findById(id);
    if (!entity) {
      throw new NotFoundException('{EntityName} not found');
    }
    return { data: entity };
  }

  // === UPDATE ===
  @Put(':id')
  @ApiOperation({ summary: 'Update {entityName}' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update{EntityName}Dto,
  ) {
    // Find existing
    const entity = await this.service.findById(id);
    if (!entity) {
      throw new NotFoundException('{EntityName} not found');
    }

    // Business logic: check name uniqueness if changing
    if (dto.name && dto.name !== entity.name) {
      const existing = await this.service.findByName(dto.name);
      if (existing) {
        throw new ConflictException('{EntityName} with this name already exists');
      }
    }

    // Update and save
    Object.assign(entity, dto);
    const saved = await this.service.save(entity);
    return { data: saved };
  }

  // === DELETE ===
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete {entityName}' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const entity = await this.service.findById(id);
    if (!entity) {
      throw new NotFoundException('{EntityName} not found');
    }

    await this.service.softRemove(entity);
  }
}
