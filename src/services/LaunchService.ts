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


import axios from 'axios';
import { EncryptService, jwtServiceInstance, userBDTOInstance, UserModel } from "clm-core";
import { CourseStructureJSON } from "clm-ext-learning_objects";
import { ToolModel } from "clm-ext-tools";
import { SHA512 } from 'crypto-js';
import express from 'express';
import queryString from 'query-string';
import sha1 from 'sha1';

const btoa = require('btoa')
const oauth = require('oauth-sign')
const encryptService = new EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');
const issuers: any[] = []
const initRequest = [];

let baseurl = (process.env.DEPLOY_URL || "http://gateway/api") + (process.env.BASE_PATH || '/launch')
// const deploy_url = process.env.DEPLOY_URL || 'http://localhost:3001'
const gateway_url = process.env.GATEWAY_URL || 'http://localhost/api'

export type Context = {
    context_id: string,
    context_title: string,
    context_label: string
    context_type: string
}

class LaunchService {

    private initialize_lti13_launch(tool: ToolModel & { roles?: string[] }, user: UserModel, context: Context): express.Handler {
        return async (req, res, next) => {
            try {
                let deployUrl = process.env.DEPLOY_URL + '/launch/lti13/platformDetails'
                let platformDetails = (await axios.get(deployUrl)).data
                let { iss, clientId } = platformDetails
                let { launchableUrl, oidc_login_url, deployment_id } = tool

                let login_hint = encryptService.encrypt(JSON.stringify({
                    client_id: clientId,
                    clientId: clientId,
                    target_link_uri: launchableUrl,
                    userId: user._id,
                    toolId: tool._id,
                    roles: tool.roles,
                    context,
                    deployment_id,
                    resourceLinkId: "1",
                    customId: tool?.customProperties?.find(({ key, value }) => key === 'id')?.value || '1'
                }))

                return res.render('lti13/init', {
                    clientId,
                    iss,
                    target_link_uri: launchableUrl,
                    lti_message_hint: 'My LTI message hint!',
                    login_hint,
                    oidc_login_url,
                    deployment_id
                })

                // let oidcResponse = await axios.post(oidc_login_url as string,
                //     queryString.stringify({
                //         clientId,
                //         iss,
                //         target_link_uri: launchableUrl,
                //         lti_message_hint: 'My LTI message hint!',
                //         lti_deployment_id: deployment_id,
                //         login_hint
                //     }),
                //     {
                //         headers: {
                //             'Content-Type': 'application/x-www-form-urlencoded'
                //         },
                //     }
                // )

                // // If the OIDC endpoint responds with a redirect
                // if (oidcResponse.status === 302 || oidcResponse.status === 301) {
                //     const redirectUrl = oidcResponse.headers.location;
                //     res.redirect(redirectUrl); // Redirect the client to the OIDC endpoint's redirect URL
                // } else {
                //     // Handle other responses as needed
                //     res.status(oidcResponse.status).send(oidcResponse.data);
                // }

            } catch (err: any) {
                return next({ message: err, status: 401 });
            }
        }


    }

    private launch_lti11_tool(options: {
        accessToken: string, toolId: string, returnUrl: string, target: string,
        context: {
            context_id: string,
            context_title: string,
            context_label: string
            context_type: string
        }
    }): express.Handler {

        return async (req, res, next) => {
            const { accessToken, toolId, returnUrl, target, context } = options;
            let baseurl = (process.env.GATEWAY_URL || process.env.DEPLOY_URL) + (process.env.BASE_PATH || '/launch')


            let body = req.body

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
                            target,
                            context,
                            ...body
                        }

                    }
                );
                try {
                    const { launchData, redirectUrl } = resp.data;
                    const html = await axios.get(
                        baseurl + `/lti-11/form`,
                        {
                            params: {
                                launchData,
                                redirectUrl,
                                returnUrl,
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
                const { context_id, context_title, context_label, context_type } = JSON.parse(req.query.context as string || "{}")

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
                    context_id as string,
                    context_title as string,
                    context_label as string,
                    context_type as string,
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
        context_title: string,
        context_label: string,
        context_type: string,
        res: express.Response,
        req: express.Request
    ) {
        let data: any = {
            ...this.getOtherParameters(user, req, res),
            ...this.getStandardLTIParams(),
        }

        data['oauth_consumer_key'] = key.trim();
        data['resource_link_id'] = resource_link_id || 1;
        data['context_id'] = context_id || 1;
        data['context_title'] = context_title || '';
        data['context_label'] = context_label || '';
        data['context_type'] = context_type || '';
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


        // data.lis_result_sourcedid = user._id + '[]' + toolId;
        // data.lis_outcome_service_url = process.env.DEPLOY_URL + '/grading-service';




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

    private getOtherParameters(user: any, req: express.Request, res: express.Response) {
        const tool = res.locals.tool;
        const isNotEmail = user.email.indexOf('@') === -1;
        if (isNotEmail) user.email = user.email.replace(/-/g, "") + '@clm.de';

        let otherParameters: { [key: string]: any } = {
            lis_person_name_given: user.givenName,
            lis_person_contact_email_primary: user.email,
            lis_person_name_family: user.familyName,
            lis_person_name_full: user.givenName + ' ' + user.familyName,
            roles: tool.roles.join(','),
            launch_presentation_document_target: tool.target,
            user_id: sha1("mailto:" + user.email),
            // custom_access_token: req.headers['x-access-token']
        }

            ;

        // client_defined user attributes
        let params = req.query as { [key: string]: any }
        for (let queryParam in params) {
            let val = params[queryParam]
            if (!['context', 'oauth_signature', 'user_id', 'lis_person_contact_email_primary', 'roles'].find((item) => item === queryParam)) {
                otherParameters[queryParam] = val
            }
        }
        return otherParameters;
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
            console.error(err)
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

    launchSpecification(type: ('CMI5' | 'LTI13' | 'LTI11'), tool: ToolModel, user: UserModel, accessToken: string,
        context: Context): express.Handler {
        return async (req, res, next) => {
            let returnUrl = req.query.returnUrl as string || ''
            let target = req.query.target as string || 'iframe'

            switch (type) {
                case 'LTI11': {
                    return this.launch_lti11_tool({ returnUrl, target, accessToken, toolId: tool._id, context })(req, res, next)
                }
                case 'LTI13': {
                    return this.initialize_lti13_launch(tool, user, context)(req, res, next)
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