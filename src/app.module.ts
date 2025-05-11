import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [MongooseModule.forRoot(DatabaseConfig.uri), UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
