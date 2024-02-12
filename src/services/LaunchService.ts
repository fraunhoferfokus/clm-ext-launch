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


import express from 'express'
import axios from 'axios'
import { CourseStructureJSON } from "clm-ext-learning_objects";
import { sha512 } from 'js-sha512'
import queryString from 'query-string'
import { v4 as uuid } from 'uuid'
import { EncryptService, jwtServiceInstance, userBDTOInstance, UserModel } from "clm-core";
import { ToolModel } from "clm-ext-tools";
import fs from 'fs'
import { generateKeyPairSync } from 'crypto'
const btoa = require('btoa')
const oauth = require('oauth-sign')


const encryptService = new EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');


const issuers: any[] = []
const initRequest = [];
let baseurl = (process.env.DEPLOY_URL || "http://gateway/api") + (process.env.BASE_PATH || '/launch')
// const deploy_url = process.env.DEPLOY_URL || 'http://localhost:3001'
const gateway_url = process.env.GATEWAY_URL || 'http://localhost/api'

class LaunchService {

    private initialize_lti13_launch(tool: ToolModel, user: UserModel): express.Handler {
        return async (req, res, next) => {

            let iss = gateway_url + '/launch'
            let login_hint = encryptService.encrypt(user._id)
            let { target_link_uri, oidc_login_url, client_id } = tool

            try {
                return res.redirect(`${oidc_login_url}?iss=${iss}&login_hint=${encodeURIComponent(login_hint)}&target_link_uri=${target_link_uri}&client_id=${client_id}`)
            } catch (err) {
                return next({ message: err, status: 401 });
            }
        }


    }

    private launch_lti11_tool(options: { accessToken: string, toolId: string, returnUrl: string, target: string }): express.Handler {

        return async (req, res, next) => {
            const { accessToken, toolId, returnUrl, target } = options;
            let baseurl = (process.env.GATEWAY_URL || process.env.DEPLOY_URL) + (process.env.BASE_PATH || '/launch')
            try {
                const resp = await axios.get(
                    gateway_url + `/launch/lti-11/${toolId}/launchdata`,
                    {
                        headers: {
                            'x-access-token': accessToken,
                            // Authorization,
                        },
                        params: {
                            returnUrl,
                            target
                        }

                    }
                );
                try {
                    const { launchData, redirectUrl } = resp.data;
                    const html = await axios.get(
                        baseurl + `/lti-11/form`,
                        {
                            params: {
                                ...launchData,
                                redirectUrl,
                                directLaunch: true,
                                returnUrl,
                                target
                            },
                        }
                    );
                    res.send(html.data);
                } catch (error: any) {
                    return next({ message: error, status: 400 });
                }
            } catch (error: any) {
                return next({ message: error, status: 401 });
            }

        }

    }

    private launch_cmi5_tool(options: { accessToken: string, toolId: string }): express.Handler {
        let { toolId, accessToken } = options
        return async (req, res, next) => {
            try {
                const resp = await axios.post(
                    baseurl + `/cmi5/${toolId}`,
                    null,
                    {
                        headers: {
                            'x-access-token': accessToken,
                            // Authorization,
                        },
                    }
                );
                const { redirect_url } = resp.data;
                const html = await axios.get(baseurl + `/cmi5/form`, {
                    params: {
                        redirect_url,
                    },
                });
                res.send(html.data);
            } catch (error: any) {
                return next({ message: error, status: 401 });
            }
        }




    };

    getPrerenderedLTI1_1Launch(toolId: string): express.Handler {
        return async (req, res, next) => {
            try {
                let fullData;
                let launchUrl;
                let user = req.requestingUser!;
                let tool = await CourseStructureJSON.getUserTool(user._id, req.params.toolId);
                res.locals.tool = tool

                if (!tool) return next({ message: `not permitted to access tool: ${req.params.toolId}`, status: 401 })

                if (tool.type != 'LTI11') {
                    return next({
                        message: {
                            expectedType: 'LTI11',
                            currentType: tool.type,
                        },
                        status: 400
                    });
                }

                let {
                    username,
                    rootUsername,
                    password,
                    rootPassword,
                    launchableUrl,
                } = tool;
                let [key, secret] = [
                    username || rootUsername,
                    password || rootPassword,
                ];

                launchUrl = launchableUrl;

                fullData = this.getFullLaunchDataObject(
                    key!,
                    secret!,
                    launchUrl,
                    user,
                    req.query.resource_link_id as string,
                    req.query.context_id as string,
                    toolId,
                    res,
                    req
                );
                launchUrl = launchUrl.replace(
                    /\?custom_navigate_to=.*/,
                    ''
                );

                return res.json({
                    launchData: fullData,
                    redirectUrl: launchUrl,
                });


            } catch (err) {
                return next({ message: err, status: 500 });
            }
        }

    }

    private getFullLaunchDataObject(key: string,
        secret: string,
        rootUrl: string,
        user: any,
        resource_link_id: string,
        context_id: string,
        toolId: string,
        res: express.Response,
        req: express.Request
    ) {
        let data: any = { ...this.getStandardLTIParams(), ...this.getPersonalDataParams(user, res) }

        data['oauth_consumer_key'] = key.trim();
        data['resource_link_id'] = resource_link_id || 1;
        data['context_id'] = context_id || 1;
        data['tool_consumer_instance_guid'] = `CLM.${process.env.DEPLOY_URL}`;

        data['launch_presentation_return_url'] = req.query.returnUrl || ''

        const tool = res.locals.tool;
        if (tool.customProperties) {
            for (const customProperty of tool.customProperties) {
                switch (customProperty.in) {
                    case 'FORM':
                        data[customProperty['key']] = customProperty['value'];
                        break;
                }
            }
        }

        const [urlWithoutQuery, ...rest] = rootUrl.split('?');
        if (rest?.length > 0) {
            let query = rest.join('?');
            const parsed = queryString.parse(query);
            data = { ...data, ...{ ...parsed } };
        }

        data.lis_result_sourcedid = user._id + '[]' + toolId;
        data.lis_outcome_service_url = process.env.DEPLOY_URL + '/grading-service';


        data['oauth_signature'] = oauth.hmacsign(
            'POST',
            urlWithoutQuery.trim(),
            data,
            secret.trim()
        );
        return data;

    }

    private getStandardLTIParams() {
        let timestamp = Math.round(Date.now() / 1000);
        let params = {
            lti_message_type: 'basic-lti-launch-request',
            lti_version: 'LTI-1p0',
            oauth_callback: 'about:blank',
            oauth_nonce: Date.now(),
            oauth_timestamp: timestamp.toString(),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_version: '1.0',
        };
        return params;
    }

    private getPersonalDataParams(user: any, res: express.Response) {
        const tool = res.locals.tool;
        const isNotEmail = user.email.indexOf('@') === -1;
        if (isNotEmail) user.email = user.email.replace(/-/g, "") + '@clm.de';
        let personalParams = {
            lis_person_name_given: user.givenName,
            lis_person_contact_email_primary: user.email,
            lis_person_name_family: user.familyName,
            lis_person_name_full: user.givenName + ' ' + user.familyName,
            roles: tool.roles.join(','),
            launch_presentation_document_target: tool.target,
            user_id: sha512(user.email)
        };
        return personalParams;
    }

    async getUserAndTool(accessToken: string, email: string, toolId: string): Promise<{ tool: ToolModel, user: UserModel }> {
        try {
            let decoded = await jwtServiceInstance.verifyToken(accessToken)
            if (decoded.sub !== email) throw { message: `The access token is not from user: ${email}`, status: 400 }
            const user = await userBDTOInstance.findById(email)

            const tool = await CourseStructureJSON.getUserTool(user._id, toolId)
            if (!tool) throw { message: `User has not access to that tool: ${toolId}`, status: 400 }
            return { user, tool }
        }
        catch (err) {
            console.log(err)
            throw { message: err, status: 500 }
        }
    }

    validate_lti11_request(body: any) {
        const email = body.lis_person_contact_email_primary;
        let accessToken = body.oauth_consumer_key

        if (!email) throw { status: 400, message: 'Email has to be provided' }
        if (!accessToken) throw { status: 400, message: 'Oauth consumer key has to be defined!' }

        return { email, accessToken, }

    }

    validate_cmi5_request(query: any) {
        let actor = JSON.parse(query.actor as string);
        let email = actor.mbox.split('mailto:')[1];
        let accessToken = query.accessToken
        if (!accessToken) throw { message: "Attribute 'accessToken' missing! (query)", status: 400 }
        if (!email) throw { message: "Email has to be provided in the 'actor' attribute! (query)", status: 400 }
        return { email, accessToken }
    }

    launchSpecification(type: ('CMI5' | 'LTI13' | 'LTI11'), tool: ToolModel, user: UserModel, accessToken: string): express.Handler {
        return async (req, res, next) => {
            let returnUrl = req.query.returnUrl as string || ''
            let target = req.query.target as string || 'iframe'

            console.log({
                type
            })

            switch (type) {
                case 'LTI11': {
                    return this.launch_lti11_tool({ returnUrl, target, accessToken, toolId: tool._id })(req, res, next)
                }
                case 'LTI13': {
                    return this.initialize_lti13_launch(tool, user)(req, res, next)
                    // throw { message: 'LTI13 currently under development...', status: 500 }
                }
                case 'CMI5': {

                    return this.launch_cmi5_tool({ accessToken, toolId: tool._id })(req, res, next)
                }
            }
        }


    }

}

export default new LaunchService()