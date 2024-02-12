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
import { BaseExtensionCtrl, UserModel } from "clm-core";
import express from 'express';
import { SPModel } from "clm-ext-service_providers";
declare class Cmi5Controller extends BaseExtensionCtrl {
    lrsDependency: (lrsIds: string[], tool: any, user: UserModel, agent: any) => Promise<void>;
    launch: express.Handler;
    getActivities: express.Handler;
    getActivityState: express.Handler;
    putActivityState: express.Handler;
    profile: express.Handler;
    authTokenGenerator: express.Handler;
    tokenMW: express.Handler;
    statements: express.Handler;
    lrsProxy: (req: express.Request, res: express.Response, next: express.NextFunction, lrss: SPModel[], path: string, method?: ('PUT' | 'POST' | 'GET')) => Promise<void | express.Response<any, Record<string, any>>>;
}
declare const controller: Cmi5Controller;
export default controller;
