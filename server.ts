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
import dotenv from 'dotenv'
dotenv.config()
const PORT = process.env.PORT
export const ROOT_DIR = process.cwd()
import { errHandler, pathBDTOInstance } from "clm-core"
import cors from 'cors'
import express from 'express'
import path from 'path'
import EntryPointController from './src/controllers/EntryPointController'
const app = express()
const basePath = process.env.BASE_PATH || '/launch'
// paths which require no API-Token
const ECLUDED_PATHS: string[] = [
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
    '/health',
]

app.use(function (req, res, next) {
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-access-token, x-token-renewed, x-api-key'
    );
    res.header(
        'Access-Control-Allow-Methods',
        'GET,PUT,POST,DELETE,PATCH,OPTIONS'
    );
    next();
});

app.use(cors())
app.use(express.json())
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, '/src/templates'))
app.use(express.urlencoded({ extended: true }))
app.get('/health', (req, res) => res.send('OK'))
// app.use(AuthGuard.requireAPIToken(ECLUDED_PATHS))
app.use(basePath, EntryPointController.router)
app.use(errHandler);

Promise.all([
    pathBDTOInstance.registerRoutes(app, ECLUDED_PATHS),
]).then(() => {
    app.listen(PORT, () => {
        console.info("listening on launch-server")
    })

})
    .catch((err) => {
        console.error(err)
    })






