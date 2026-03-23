"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    var _a;
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    const port = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000);
    await app.listen(port, '0.0.0.0');
}
bootstrap();
