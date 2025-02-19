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
"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const clm_core_1 = require("clm-core");
const clm_ext_learning_objects_1 = require("clm-ext-learning_objects");
const query_string_1 = __importDefault(require("query-string"));
const sha1_1 = __importDefault(require("sha1"));
const btoa = require('btoa');
const oauth = require('oauth-sign');
const encryptService = new clm_core_1.EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');
const issuers = [];
const initRequest = [];
let baseurl = (process.env.DEPLOY_URL || "http://gateway/api") + (process.env.BASE_PATH || '/launch');
// const deploy_url = process.env.DEPLOY_URL || 'http://localhost:3001'
const gateway_url = process.env.GATEWAY_URL || 'http://localhost/api';
class LaunchService {
    initialize_lti13_launch(tool, user, context) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                let deployUrl = process.env.DEPLOY_URL + '/launch/lti13/platformDetails';
                let platformDetails = (yield axios_1.default.get(deployUrl)).data;
                let { iss, clientId } = platformDetails;
                let { launchableUrl, oidc_login_url, deployment_id } = tool;
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
                    customId: ((_b = (_a = tool === null || tool === void 0 ? void 0 : tool.customProperties) === null || _a === void 0 ? void 0 : _a.find(({ key, value }) => key === 'id')) === null || _b === void 0 ? void 0 : _b.value) || '1'
                }));
                return res.render('lti13/init', {
                    clientId,
                    iss,
                    target_link_uri: launchableUrl,
                    lti_message_hint: 'My LTI message hint!',
                    login_hint,
                    oidc_login_url,
                    deployment_id
                });
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
            }
            catch (err) {
                return next({ message: err, status: 401 });
            }
        });
    }
    launch_lti11_tool(options) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { accessToken, toolId, returnUrl, target, context } = options;
            let baseurl = (process.env.GATEWAY_URL || process.env.DEPLOY_URL) + (process.env.BASE_PATH || '/launch');
            let body = req.body;
            try {
                const resp = yield axios_1.default.get(gateway_url + `/launch/lti-11/${toolId}/launchdata`, {
                    headers: {
                        'x-access-token': accessToken,
                        // Authorization,
                    },
                    params: Object.assign({ returnUrl,
                        target,
                        context }, body)
                });
                try {
                    const { launchData, redirectUrl } = resp.data;
                    const html = yield axios_1.default.get(baseurl + `/lti-11/form`, {
                        params: {
                            launchData,
                            redirectUrl,
                            returnUrl,
                        },
                    });
                    res.send(html.data);
                }
                catch (error) {
                    return next({ message: error, status: 400 });
                }
            }
            catch (error) {
                return next({ message: error, status: 401 });
            }
        });
    }
    launch_cmi5_tool(options) {
        let { toolId, accessToken } = options;
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const resp = yield axios_1.default.post(baseurl + `/cmi5/${toolId}`, null, {
                    headers: {
                        'x-access-token': accessToken,
                        // Authorization,
                    },
                });
                const { redirect_url } = resp.data;
                const html = yield axios_1.default.get(baseurl + `/cmi5/form`, {
                    params: {
                        redirect_url,
                    },
                });
                res.send(html.data);
            }
            catch (error) {
                return next({ message: error, status: 401 });
            }
        });
    }
    ;
    getPrerenderedLTI1_1Launch(toolId) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                let fullData;
                let launchUrl;
                let user = req.requestingUser;
                let tool = yield clm_ext_learning_objects_1.CourseStructureJSON.getUserTool(user._id, req.params.toolId);
                res.locals.tool = tool;
                const { context_id, context_title, context_label, context_type } = JSON.parse(req.query.context || "{}");
                if (!tool)
                    return next({ message: `not permitted to access tool: ${req.params.toolId}`, status: 401 });
                if (tool.type != 'LTI11') {
                    return next({
                        message: {
                            expectedType: 'LTI11',
                            currentType: tool.type,
                        },
                        status: 400
                    });
                }
                let { username, rootUsername, password, rootPassword, launchableUrl, } = tool;
                let [key, secret] = [
                    username || rootUsername,
                    password || rootPassword,
                ];
                launchUrl = launchableUrl;
                fullData = this.getFullLaunchDataObject(key, secret, launchUrl, user, req.query.resource_link_id, context_id, context_title, context_label, context_type, res, req);
                launchUrl = launchUrl.replace(/\?custom_navigate_to=.*/, '');
                return res.json({
                    launchData: fullData,
                    redirectUrl: launchUrl,
                });
            }
            catch (err) {
                return next({ message: err, status: 500 });
            }
        });
    }
    getFullLaunchDataObject(key, secret, rootUrl, user, resource_link_id, context_id, context_title, context_label, context_type, res, req) {
        let data = Object.assign(Object.assign({}, this.getOtherParameters(user, req, res)), this.getStandardLTIParams());
        data['oauth_consumer_key'] = key.trim();
        data['resource_link_id'] = resource_link_id || 1;
        data['context_id'] = context_id || 1;
        data['context_title'] = context_title || '';
        data['context_label'] = context_label || '';
        data['context_type'] = context_type || '';
        data['tool_consumer_instance_guid'] = `CLM.${process.env.DEPLOY_URL}`;
        data['launch_presentation_return_url'] = req.query.returnUrl || '';
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
        if ((rest === null || rest === void 0 ? void 0 : rest.length) > 0) {
            let query = rest.join('?');
            const parsed = query_string_1.default.parse(query);
            data = Object.assign(Object.assign({}, data), Object.assign({}, parsed));
        }
        // data.lis_result_sourcedid = user._id + '[]' + toolId;
        // data.lis_outcome_service_url = process.env.DEPLOY_URL + '/grading-service';
        data['oauth_signature'] = oauth.hmacsign('POST', urlWithoutQuery.trim(), data, secret.trim());
        return data;
    }
    getStandardLTIParams() {
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
    getOtherParameters(user, req, res) {
        const tool = res.locals.tool;
        const isNotEmail = user.email.indexOf('@') === -1;
        if (isNotEmail)
            user.email = user.email.replace(/-/g, "") + '@clm.de';
        let otherParameters = {
            lis_person_name_given: user.givenName,
            lis_person_contact_email_primary: user.email,
            lis_person_name_family: user.familyName,
            lis_person_name_full: user.givenName + ' ' + user.familyName,
            roles: tool.roles.join(','),
            launch_presentation_document_target: tool.target,
            user_id: (0, sha1_1.default)("mailto:" + user.email),
            // custom_access_token: req.headers['x-access-token']
        };
        // client_defined user attributes
        let params = req.query;
        for (let queryParam in params) {
            let val = params[queryParam];
            if (!['context', 'oauth_signature', 'user_id', 'lis_person_contact_email_primary', 'roles'].find((item) => item === queryParam)) {
                otherParameters[queryParam] = val;
            }
        }
        return otherParameters;
    }
    getUserAndTool(accessToken, email, toolId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let decoded = yield clm_core_1.jwtServiceInstance.verifyToken(accessToken);
                if (decoded.sub !== email)
                    throw { message: `The access token is not from user: ${email}`, status: 400 };
                const user = yield clm_core_1.userBDTOInstance.findById(email);
                const tool = yield clm_ext_learning_objects_1.CourseStructureJSON.getUserTool(user._id, toolId);
                if (!tool)
                    throw { message: `User has not access to that tool: ${toolId}`, status: 400 };
                return { user, tool };
            }
            catch (err) {
                console.error(err);
                throw { message: err, status: 500 };
            }
        });
    }
    validate_lti11_request(body) {
        const email = body.lis_person_contact_email_primary;
        let accessToken = body.oauth_consumer_key;
        if (!email)
            throw { status: 400, message: 'Email has to be provided' };
        if (!accessToken)
            throw { status: 400, message: 'Oauth consumer key has to be defined!' };
        return { email, accessToken, };
    }
    validate_cmi5_request(query) {
        let actor = JSON.parse(query.actor);
        let email = actor.mbox.split('mailto:')[1];
        let accessToken = query.accessToken;
        if (!accessToken)
            throw { message: "Attribute 'accessToken' missing! (query)", status: 400 };
        if (!email)
            throw { message: "Email has to be provided in the 'actor' attribute! (query)", status: 400 };
        return { email, accessToken };
    }
    launchSpecification(type, tool, user, accessToken, context) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            let returnUrl = req.query.returnUrl || '';
            let target = req.query.target || 'iframe';
            switch (type) {
                case 'LTI11': {
                    return this.launch_lti11_tool({ returnUrl, target, accessToken, toolId: tool._id, context })(req, res, next);
                }
                case 'LTI13': {
                    return this.initialize_lti13_launch(tool, user, context)(req, res, next);
                    // throw { message: 'LTI13 currently under development...', status: 500 }
                }
                case 'CMI5': {
                    return this.launch_cmi5_tool({ accessToken, toolId: tool._id })(req, res, next);
                }
            }
        });
    }
}
exports.default = new LaunchService();
