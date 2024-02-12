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
const clm_ext_learning_objects_1 = require("clm-ext-learning_objects");
const js_sha512_1 = require("js-sha512");
const query_string_1 = __importDefault(require("query-string"));
const clm_core_1 = require("clm-core");
const btoa = require('btoa');
const oauth = require('oauth-sign');
const encryptService = new clm_core_1.EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');
const issuers = [];
const initRequest = [];
let baseurl = (process.env.GATEWAY_URL || process.env.DEPLOY_URL || '') + (process.env.BASE_PATH || '/launch');
const deploy_url = process.env.DEPLOY_URL || 'http://localhost:3001';
class LaunchService {
    initialize_lti13_launch(tool, user) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            let iss = deploy_url + '/launch';
            let login_hint = encryptService.encrypt(user._id);
            let { target_link_uri, oidc_login_url, client_id } = tool;
            try {
                return res.redirect(`${oidc_login_url}?iss=${iss}&login_hint=${encodeURIComponent(login_hint)}&target_link_uri=${target_link_uri}&client_id=${client_id}`);
            }
            catch (err) {
                return next({ message: err, status: 401 });
            }
        });
    }
    launch_lti11_tool(options) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { accessToken, toolId, returnUrl, target } = options;
            try {
                const resp = yield axios_1.default.get(baseurl + `/lti-11/${toolId}/launchdata`, {
                    headers: {
                        'x-access-token': accessToken,
                        // Authorization,
                    },
                    params: {
                        returnUrl,
                        target
                    }
                });
                try {
                    const { launchData, redirectUrl } = resp.data;
                    const html = yield axios_1.default.get(baseurl + `/lti-11/form`, {
                        params: Object.assign(Object.assign({}, launchData), { redirectUrl, directLaunch: true, returnUrl,
                            target }),
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
                fullData = this.getFullLaunchDataObject(key, secret, launchUrl, user, req.query.resource_link_id, req.query.context_id, toolId, res, req);
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
    getFullLaunchDataObject(key, secret, rootUrl, user, resource_link_id, context_id, toolId, res, req) {
        let data = Object.assign(Object.assign({}, this.getStandardLTIParams()), this.getPersonalDataParams(user, res));
        data['oauth_consumer_key'] = key.trim();
        data['resource_link_id'] = resource_link_id || 1;
        data['context_id'] = context_id || 1;
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
        data.lis_result_sourcedid = user._id + '[]' + toolId;
        data.lis_outcome_service_url = process.env.DEPLOY_URL + '/grading-service';
        data['oauth_signature'] = oauth.hmacsign('POST', urlWithoutQuery.trim(), data, secret.trim());
        return data;
    }
    getStandardLTIParams() {
        let timestamp = Math.round(Date.now() / 1000);
        let params = {
            lti_message_type: 'basic-lti-launch-request',
            lti_version: 'LTI-1p0',
            oauth_callback: 'about:blank',
            oauth_nonce: btoa(timestamp),
            oauth_timestamp: timestamp.toString(),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_version: '1.0',
        };
        return params;
    }
    getPersonalDataParams(user, res) {
        const tool = res.locals.tool;
        let personalParams = {
            lis_person_name_given: user.givenName,
            lis_person_contact_email_primary: user.email,
            lis_person_name_family: user.familyName,
            lis_person_name_full: user.givenName + ' ' + user.familyName,
            roles: tool.roles.join(','),
            launch_presentation_document_target: tool.target,
            user_id: (0, js_sha512_1.sha512)(user.email)
        };
        return personalParams;
    }
    getUserAndTool(accessToken, email, toolId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let decoded = yield clm_core_1.jwtServiceInstance.verifyToken(accessToken);
                if (decoded._id !== email)
                    throw { message: `The access token is not from user: ${email}`, status: 400 };
                const user = yield clm_core_1.userBDTOInstance.findById(email);
                const tool = yield clm_ext_learning_objects_1.CourseStructureJSON.getUserTool(user._id, toolId);
                if (!tool)
                    throw { message: `User has not access to that tool: ${toolId}`, status: 400 };
                return { user, tool };
            }
            catch (err) {
                console.log(err);
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
    launchSpecification(type, tool, user, accessToken) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            let returnUrl = req.query.returnUrl || '';
            let target = req.query.target || 'iframe';
            switch (type) {
                case 'LTI11': {
                    return this.launch_lti11_tool({ returnUrl, target, accessToken, toolId: tool._id })(req, res, next);
                }
                case 'LTI13': {
                    return this.initialize_lti13_launch(tool, user)(req, res, next);
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
