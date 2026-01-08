// Template for NestJS Module
// Replace: {EntityName}, {entityName}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { {EntityName} } from './entities/{entityName}.entity';
import { {EntityName}Service } from './{entityName}.service';
import { {EntityName}Controller } from './{entityName}.controller';

@Module({
  imports: [TypeOrmModule.forFeature([{EntityName}])],
  controllers: [{EntityName}Controller],
  providers: [{EntityName}Service],
  exports: [{EntityName}Service], // Export if other modules need this service
})
export class {EntityName}Module {}

// Don't forget to import this module in AppModule:
// 
// @Module({
//   imports: [
//     ...
//     {EntityName}Module,
//   ],
// })
// export class AppModule {}
