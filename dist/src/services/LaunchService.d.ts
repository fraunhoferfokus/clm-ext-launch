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
import express from 'express';
import { UserModel } from "clm-core";
import { ToolModel } from "clm-ext-tools";
declare class LaunchService {
    private initialize_lti13_launch;
    private launch_lti11_tool;
    private launch_cmi5_tool;
    getPrerenderedLTI1_1Launch(toolId: string): express.Handler;
    private getFullLaunchDataObject;
    private getStandardLTIParams;
    private getPersonalDataParams;
    getUserAndTool(accessToken: string, email: string, toolId: string): Promise<{
        tool: ToolModel;
        user: UserModel;
    }>;
    validate_lti11_request(body: any): {
        email: any;
        accessToken: any;
    };
    validate_cmi5_request(query: any): {
        email: any;
        accessToken: any;
    };
    launchSpecification(type: ('CMI5' | 'LTI13' | 'LTI11'), tool: ToolModel, user: UserModel, accessToken: string): express.Handler;
}
declare const _default: LaunchService;
export default _default;
