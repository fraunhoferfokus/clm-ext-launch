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

const clm_core_1 = require("clm-core");
const clm_ext_service_providers_1 = require("clm-ext-service_providers");
const axios_1 = __importDefault(require("axios"));
const clm_ext_learning_objects_1 = require("clm-ext-learning_objects");
const sha1_1 = __importDefault(require("sha1"));
const query_string_1 = __importDefault(require("query-string"));
const uuid_1 = require("uuid");
let state = {};
let baseurl = (process.env.DEPLOY_URL || '') + (process.env.BASE_PATH || '/launch');
class Cmi5Controller extends clm_core_1.BaseExtensionCtrl {
    constructor() {
        super(...arguments);
        this.lrsDependency = (lrsIds, tool, user, agent) => __awaiter(this, void 0, void 0, function* () {
            const lrss = (yield clm_ext_service_providers_1.spBDTOInstance.findAll()).filter((service) => lrsIds.includes(service._id));
            const stringified = query_string_1.default.stringify({
                stateId: 'LMS.LaunchData',
                activityId: tool.activityId,
                agent: agent,
                registration: tool._id
            });
            const putRequests = [];
            for (const lrs of lrss) {
                const token = Buffer.from(`${lrs.username}:${lrs.password}`).toString('base64');
                const headers = {
                    authorization: `Basic ${token}`,
                    'x-experience-api-version': '1.0.0',
                    'Content-Type': 'application/json'
                };
                const fullUrl = `${lrs.baseUrl}/activities/state?${stringified}`;
                putRequests.push(axios_1.default.put(fullUrl, {
                    "contextTemplate": {
                        "contextActivities": {
                            "grouping": {
                                "id": "http://example.com/activities/hang-gliding-school"
                            }
                        },
                        "extensions": {
                            "https://w3id.org/xapi/cmi5/context/extensions/sessionid": "http://t1RZa11ZmyhCOLK4SbvXMnnM_wY-EWza_rise/activity"
                        }
                    },
                    "launchMode": "Normal"
                }, { headers }).then(() => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const query = query_string_1.default.stringify({
                        profileId: 'cmi5LearnerPreferences',
                        agent: agent,
                    });
                    const url = `${lrs.baseUrl}/agents/profile?${query}`;
                    try {
                        yield axios_1.default.put(url, {
                            "languagePreference": "en-US,fr-FR,de-DE",
                            "context": {
                                "audioPreference": "off"
                            }
                        }, { headers: Object.assign({ 'if-none-match': "*" }, headers) });
                    }
                    catch (err) {
                        const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
                        if (status !== 412)
                            throw err;
                    }
                })).catch((err) => { throw err; }));
            }
            yield Promise.all(putRequests);
        });
        this.launch = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                let user = req.requestingUser;
                let tool = yield clm_ext_learning_objects_1.CourseStructureJSON.getUserTool(user._id, req.params.toolId);
                if (!tool)
                    return next({ message: `not permitted to access tool: ${req.params.toolId}`, status: 401 });
                const name = (0, sha1_1.default)(user.email);
                const stringifiedAgent = JSON.stringify({
                    objectType: 'Agent',
                    account: {
                        homePage: 'https://bwcoretech.fokus.fraunhofer.de/app',
                        name
                    }
                });
                const token = Buffer.from(`${(0, uuid_1.v4)()}:${tool.lrss.join(',')}`).toString('base64');
                const fetch = `${baseurl}/cmi5/authTokenGenerator/${token}`;
                const endpoint = `${baseurl}/cmi5/data/xAPI`;
                state[token] = true;
                const lastStringified = query_string_1.default.stringify({
                    endpoint,
                    fetch,
                    registration: tool._id,
                    activityId: tool.activityId,
                    actor: stringifiedAgent
                });
                return res.json({ redirect_url: `${tool.launchableUrl}?${lastStringified}` });
            }
            catch (err) {
                return next(err);
            }
        });
        this.getActivities = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            res.setHeader('access-control-expose-headers', '*');
            const lrss = res.locals.lrss;
            if (lrss.length > 0) {
                return this.lrsProxy(req, res, next, lrss, 'activities');
            }
            else {
                const { activityId } = req.query;
                const sample = {
                    "objectType": "Activity",
                    "id": activityId,
                    "definition": {},
                    "context": {
                        "contextActivities": {
                            "category": [
                                "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                            ],
                            "grouping": [
                                "http://example.com/activities/hang-gliding-school",
                                "http://id.tincanapi.com/activity/software/scormdriver/7.7.0.a1"
                            ]
                        }
                    }
                };
                return res.json(sample);
            }
        });
        this.getActivityState = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const lrss = res.locals.lrss;
            res.setHeader('access-control-expose-headers', 'ETag');
            if (lrss.length > 0) {
                return this.lrsProxy(req, res, next, lrss, 'activities/state');
            }
            else {
                let sample;
                switch (req.query.stateId) {
                    case 'LMS.LaunchData':
                        sample = {
                            "contextTemplate": {
                                "contextActivities": {
                                    "grouping": {
                                        "id": "http://example.com/activities/hang-gliding-school"
                                    }
                                },
                                "extensions": {
                                    "https://w3id.org/xapi/cmi5/context/extensions/sessionid": "http://t1RZa11ZmyhCOLK4SbvXMnnM_wY-EWza_rise/activity"
                                }
                            },
                            "launchMode": "Normal"
                        };
                        break;
                    case 'status':
                        sample = {
                            "completion": null,
                            "success": null,
                            "score": null,
                            "launchModes": ["Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal", "Normal",
                                "Normal"
                            ]
                        };
                        break;
                    case 'cumulative_time':
                        sample = 2949449;
                        break;
                }
                return res.json(sample);
            }
        });
        this.putActivityState = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const lrss = res.locals.lrss;
            if (lrss.length > 0) {
                return this.lrsProxy(req, res, next, lrss, 'activities/state', 'PUT');
            }
            else {
                return res.status(204).send();
            }
        });
        this.profile = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            res.setHeader('access-control-expose-headers', 'ETag');
            const lrss = res.locals.lrss;
            if (lrss.length > 0) {
                return this.lrsProxy(req, res, next, lrss, 'agents/profile');
            }
            else {
                const sample = {
                    "languagePreference": "en-US,fr-FR,de-DE",
                    "context": {
                        "audioPreference": "off"
                    }
                };
                return res.json(sample);
            }
        });
        this.authTokenGenerator = (req, res, next) => {
            delete state[req.params.id];
            return res.json({ 'auth-token': req.params.id });
        };
        this.tokenMW = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _b;
            try {
                const authHeader = (_b = req.get('Authorization')) === null || _b === void 0 ? void 0 : _b.split('Basic ')[1];
                if (!authHeader)
                    return next({ message: "Authorization header needs to be present", status: 400 });
                const lrsIds = Buffer.from(authHeader, 'base64').toString('utf-8').split(':')[1].split(',');
                res.locals.lrss = (yield clm_ext_service_providers_1.spBDTOInstance.findAll()).filter((lrs) => lrsIds.includes(lrs._id));
                return next();
            }
            catch (err) {
                console.error({ err });
                return next(err);
            }
        });
        this.statements = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            res.setHeader('access-control-expose-headers', 'ETag');
            const lrss = res.locals.lrss;
            if (lrss.length > 0) {
                return this.lrsProxy(req, res, next, lrss, 'statements', 'PUT');
            }
            else {
                return res.status(204).send();
            }
        });
        this.lrsProxy = (req, res, next, lrss, path, method = 'GET') => __awaiter(this, void 0, void 0, function* () {
            const lrs = lrss[0];
            const token = Buffer.from(`${lrs.username}:${lrs.password}`).toString('base64');
            const query = req.originalUrl.split('?')[1];
            const redirect_url = `${lrs.baseUrl}/${path}?${query}`;
            const contentType = req.get('Content-Type');
            let data = method === 'GET' ? undefined : req.body;
            let headers = {
                authorization: `Basic ${token}`,
                'X-Experience-API-Version': '1.0.2',
            };
            if (contentType)
                headers['Content-Type'] = contentType;
            return (0, axios_1.default)({
                url: redirect_url,
                method,
                data,
                headers
            }).then((response) => {
                const headers = response.headers;
                for (const headerKey in headers)
                    res.setHeader(headerKey, headers[headerKey]);
                if (headers['content-type'] === 'application/json') {
                    return res.json(response.data);
                }
                else {
                    let data = response.data;
                    if (typeof data === 'number')
                        data = data.toString();
                    return res.send(data);
                }
            }).catch((err) => {
                var _a, _b;
                return next({ message: ((_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.data) || "error occured", status: ((_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.status) || 500 });
            });
        });
    }
}
const controller = new Cmi5Controller();
controller.router.get('/data/xAPI/agents/profile', controller.tokenMW, controller.profile);
controller.router.get('/data/xAPI/activities/state', controller.tokenMW, controller.getActivityState);
controller.router.put('/data/xAPI/activities/state', controller.tokenMW, controller.putActivityState);
controller.router.get('/data/xAPI/activities', controller.tokenMW, controller.getActivities);
controller.router.put('/data/xAPI/statements', controller.tokenMW, controller.statements);
controller.router.post('/authTokenGenerator/:id', controller.authTokenGenerator);
controller.router.post('/:toolId', clm_core_1.AuthGuard.requireUserAuthentication(), controller.launch);
exports.default = controller;
