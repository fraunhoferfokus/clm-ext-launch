"use strict";
/* -----------------------------------------------------------------------------
 *  Copyright (c) 2023, Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, version 3.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 *  No Patent Rights, Trademark Rights and/or other Intellectual Property
 *  Rights other than the rights under this license are granted.
 *  All other rights reserved.
 *
 *  For any other rights, a separate agreement needs to be closed.
 *
 *  For more information please contact:
 *  Fraunhofer FOKUS
 *  Kaiserin-Augusta-Allee 31
 *  10589 Berlin, Germany
 *  https://www.fokus.fraunhofer.de/go/fame
 *  famecontact@fokus.fraunhofer.de
 * -----------------------------------------------------------------------------
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_DIR = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = process.env.PORT;
exports.ROOT_DIR = process.cwd();
const clm_core_1 = require("clm-core");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const EntryPointController_1 = __importDefault(require("./src/controllers/EntryPointController"));
const app = (0, express_1.default)();
const basePath = process.env.BASE_PATH || '/launch';
// paths which require no API-Token
const ECLUDED_PATHS = [
    `${basePath}/:tooldId`,
    `${basePath}/cmi5/form`,
    `${basePath}/cmi5/data/xAPI/agents/profile`,
    `${basePath}/cmi5/data/xAPI/activities/state`,
    `${basePath}/cmi5/data/xAPI/activities`,
    `${basePath}/cmi5/data/xAPI/statements`,
    `${basePath}/cmi5/authTokenGenerator/:id`,
    `${basePath}/cmi5/:id`,
    `${basePath}/lti-11/form`,
    `${basePath}/lti-11/:toolId/launchdata`,
    `${basePath}/swagger`,
    `${basePath}/lti-13/platformDetails`,
    `${basePath}/lti-13/auth`,
    `${basePath}/lti-13/jwks`,
    `${basePath}/lti-13/token`,
    '/health',
];
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-access-token, x-token-renewed, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    next();
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.set('view engine', 'ejs');
app.set('views', path_1.default.join(exports.ROOT_DIR, '/src/templates'));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => res.send('OK'));
// app.use(AuthGuard.requireAPIToken(ECLUDED_PATHS))
app.use(basePath, EntryPointController_1.default.router);
app.use(clm_core_1.errHandler);
Promise.all([
    clm_core_1.pathBDTOInstance.registerRoutes(app, ECLUDED_PATHS),
]).then(() => {
    app.listen(PORT, () => {
        console.info("listening on launch-server");
    });
})
    .catch((err) => {
    console.error(err);
});
