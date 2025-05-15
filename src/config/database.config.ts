export class DatabaseConfig {
  static uri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/nest-user-auth';
}
