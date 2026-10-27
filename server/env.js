import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDirectory, '.env') });
