// Template for DTOs
// Replace: {EntityName}, {entityName}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';

// === CREATE DTO ===
export class Create{EntityName}Dto {
  @ApiProperty({ description: 'Name of the entity', example: 'Example Name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Optional description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  // Add more fields as needed
}

// === UPDATE DTO ===
export class Update{EntityName}Dto extends PartialType(Create{EntityName}Dto) {}

// === LIST/FILTER DTO ===
export class List{EntityName}Dto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by name' })
  @IsOptional()
  @IsString()
  name?: string;
}

// === RESPONSE DTO (optional) ===
export class {EntityName}ResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
