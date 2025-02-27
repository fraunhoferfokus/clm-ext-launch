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
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const clm_core_1 = require("clm-core");
const ejs_1 = __importDefault(require("ejs"));
const fs_1 = __importDefault(require("fs"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const server_1 = require("../../server");
const LaunchService_1 = __importDefault(require("../services/LaunchService"));
const cmi5Controller_1 = __importDefault(require("./cmi5Controller"));
const lti13Controller_1 = __importDefault(require("./lti13Controller"));
/**
 * @openapi
 * components:
 *   schemas:
 *     relation:
 *       type: object
 *       properties:
 *         fromType:
 *           type: string
 *           description: The type of the node
 *           default: fromTypeNode
 *         toType:
 *           type: string
 *           description: The type of the target node
 *           default: toTypeNode
 *         fromId:
 *           type: string
 *           description: The id of the node
 *           default: fromNodeId
 *         toId:
 *           type: string
 *           description: The id of the target node
 *           default: toNodeId
 *         order:
 *           type: number
 *           description: The order of the relation. Used for example ordering the enrollments of a group/user
 *           default: 0
 *   parameters:
 *     accessToken:
 *       name: x-access-token
 *       in: header
 *       description: The access token
 *       required: true
 *       example: exampleAccessToken
 *       schema:
 *         type: string
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *     refreshAuth:
 *       type: apiKey
 *       in: header
 *       name: x-refresh-token
 */
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'CLM-EXT-LAUNCH',
            version: '1.0.0',
            description: 'API endpoints the clm-ext-launch module offers',
        },
        servers: [
            {
                "url": "{scheme}://{hostname}:{port}{path}",
                "description": "The production API server",
                "variables": {
                    "hostname": {
                        "default": "localhost",
                    },
                    "port": {
                        "default": `${process.env.PORT}`
                    },
                    "path": {
                        "default": ""
                    },
                    "scheme": {
                        "default": "http",
                    }
                }
            }
        ],
        security: [{
                bearerAuth: [],
            }]
    },
    apis: [
        './src/controllers/*.ts'
    ]
};
const swaggerSpecification = (0, swagger_jsdoc_1.default)(options);
const KID = process.env.KID || '1';
const encryptService = new clm_core_1.EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');
const lti11form = fs_1.default.readFileSync(server_1.ROOT_DIR + '/src/templates/lti11form.ejs').toString();
const lti11formSelf = fs_1.default.readFileSync(server_1.ROOT_DIR + '/src/templates/lti11formSelf.ejs').toString();
class LaunchController extends clm_core_1.BaseExtensionCtrl {
    constructor() {
        super(...arguments);
        this.specTranslator = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            let toolId = req.params.toolId;
            const body = req.body;
            const { context_id, context_title, context_type, context_label } = body;
            const context = { context_id, context_title, context_type, context_label };
            const query = req.query;
            try {
                // CMI5 LAUNCH REQUEST
                if (req.query.actor) {
                    const { accessToken, email } = LaunchService_1.default.validate_cmi5_request(query);
                    const { tool, user } = yield LaunchService_1.default.getUserAndTool(accessToken, email, toolId);
                    return LaunchService_1.default.launchSpecification(tool.type, tool, user, accessToken, context)(req, res, next);
                }
                // LTI11 LAUNCH REQUEST
                if (req.body.oauth_consumer_key) {
                    const { accessToken, email } = LaunchService_1.default.validate_lti11_request(body);
                    const { tool, user } = yield LaunchService_1.default.getUserAndTool(accessToken, email, toolId);
                    return LaunchService_1.default.launchSpecification(tool.type, tool, user, accessToken, context)(req, res, next);
                }
                //  LTI13 LAUNCH REQUEST
                if (req.query.iss) {
                    return res.status(500).json({ message: 'LTI13 currently under development...' });
                }
            }
            catch (err) {
                return next(err);
            }
            return next({ message: "not supported specification", status: 400 });
        });
        this.lti11form = (req, res, next) => {
            let launchDataQuery = req.query.launchData;
            let { redirectUrl, returnUrl } = req.query;
            if (!launchDataQuery)
                return next({ message: 'launch data query parameter has to be defined!', status: 400 });
            if (redirectUrl == null || redirectUrl == undefined)
                return next({ message: 'redirectUrl missing', status: 400 });
            let launchData;
            try {
                launchData = JSON.parse(req.query.launchData);
                // function tryParseJSON(jsonString: string) {
                //     try {
                //         let parsed = JSON.parse(jsonString);
                //         // Only return parsed object if it truly is an object
                //         return (parsed && typeof parsed === "object") ? parsed : jsonString;
                //     } catch (e) {
                //         return jsonString;
                //     }
                // }
                // for (let key in launchData) {
                //     if (launchData.hasOwnProperty(key)) {
                //         if (key.startsWith('custom_') || key.startsWith('ext_') || key === 'context') {
                //             launchData[key] = tryParseJSON(launchData[key]);
                //         }
                //     }
                // }
            }
            catch (err) {
                return next({ message: 'Launch data query must be an object', status: 400 });
            }
            let toolTarget = launchData['launch_presentation_document_target'];
            const launchData_ary = Object.entries(launchData);
            try {
                let form = (toolTarget === '_self') ? lti11formSelf : lti11form;
                let html = ejs_1.default.render(form, { launchData_ary, redirectUrl, launchData, returnUrl });
                return res.send(html);
            }
            catch (e) {
                return next({ message: e, status: 500 });
            }
        };
        this.cmi5form = (req, res, next) => {
            let { redirect_url } = req.query;
            if (redirect_url == null || redirect_url == undefined)
                return next({ message: 'redirectUrl missing', status: 400 });
            try {
                const html = ejs_1.default.render(`
            <!DOCTYPE html style="height: 100%; width: 100%">
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Document</title>
        </head>
        <body style="height: 100%; width: 100%">
        <iframe  frameBorder="0" width="100%" height="100%" src=" <%= redirect_url %>" title="CMI5 Launch">
</iframe>
        </html>
                `, { redirect_url });
                res.send(html);
            }
            catch (e) {
                return next({ message: e, status: 500 });
            }
        };
        this.lti11_launchData = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                return LaunchService_1.default.getPrerenderedLTI1_1Launch(req.params.toolId)(req, res, next);
            }
            catch (err) {
                next(err);
            }
        });
    }
}
const controller = new LaunchController();
// lti 13 routes
// controller.router.post('/oidc/auth', controller.oidc_auth_endpoint)
// controller.router.get('/jwks', controller.jwks)
controller.router.use('/lti13', lti13Controller_1.default.router);
controller.router.get('/lti-11/:toolId/launchdata', clm_core_1.AuthGuard.requireUserAuthentication(), controller.lti11_launchData);
controller.router.get('/cmi5/form', controller.cmi5form);
controller.router.get('/lti-11/form', controller.lti11form);
controller.router.use('/cmi5', cmi5Controller_1.default.router);
controller.router.use('/swagger', (req, res) => {
    return res.json(swaggerSpecification);
});
/**
 * @openapi
 * paths:
 *   /launch/{toolId}:  # Replace with your actual basePath value
 *     get:
 *       tags:
 *         - pblc
 *       summary: Launches an existing tool by toolId (CMI5)
 *       operationId: quickLaunch
 *       description: The displayed parameters do not reflect all the necessary parameters to launch the tools. Please refer to the CMI5 specification for more information. In addition to the attributes required for the specifications, an email must always be included.
 *       parameters:
 *         - name: toolId
 *           in: path
 *           required: true
 *           description: toolId of launchable object
 *           example: toolId
 *           schema:
 *              type: string
 *         - name: accessToken
 *           in: query
 *           required: true
 *           description: Access Token of user
 *           example: example-access-token
 *           schema:
 *              type: string
 *         - name: endpoint
 *           in: query
 *           description: LRS endpoint (CMI5)
 *           example: endpoint
 *           schema:
 *              type: string
 *         - name: fetch
 *           in: query
 *           description: Fetch API endpoint (CMI5)
 *           example: fetch
 *           schema:
 *              type: string
 *         - name: registration
 *           in: query
 *           description: Registration (CMI5)
 *           example: registration
 *           schema:
 *              type: string
 *         - name: activityId
 *           in: query
 *           description: ActivityId of tool (CMI5)
 *           example: activityId
 *           schema:
 *              type: string
 *         - name: actor
 *           in: query
 *           description: Experience-API Actor object (CMI5)
 *           example: actor
 *           schema:
 *              type: string
 *         - name: iss
 *           in: query
 *           description: (LTI13)
 *           example: clm
 *           schema:
 *              type: string
 *         - name: login_hint
 *           in: query
 *           description: (LTI13)
 *           example: 12345
 *           schema:
 *              type: string
 *       responses:
 *         200:
 *           description: Successful operation
 *     post:
 *       tags:
 *         - pblc
 *       summary: Launches an existing tool by toolId (LTI11)
 *       description: The displayed parameters do not reflect all the necessary parameters to launch the tools. Please refer to the LTI11 specification for more information. In addition to the attributes required for the specifications, an email must always be included.
 *       parameters:
 *         - name: toolId
 *           in: path
 *           required: true
 *           description: toolId of launchable object
 *           example: toolId
 *           schema:
 *              type: string
 *       requestBody:
 *         content:
 *           application/x-www-form-urlencoded:
 *             schema:
 *               type: object
 *               required: ['oauth_consumer_key', 'lis_person_contact_email_primary']
 *               properties:
 *                 oauth_consumer_key:
 *                   type: string
 *                   description: the access-token of the user
 *                   default: example-access-token
 *                 lis_person_contact_email_primary:
 *                   type: string
 *                   description: the email of the user
 *                   default: fame@fokus.fraunhofer.de
 *                 context_id:
 *                   type: string
 *                 context_title:
 *                   type: string
 *                 context_label:
 *                   type: string
 *                 context_type:
 *                   type: string
 *                 tool_consumer_instance_guid:
 *                   type: string
 *                 launch_presentation_return_url:
 *                   type: string
 *                 resource_link_id:
 *                   type: string
 *                 lis_result_sourcedid:
 *                   type: string
 *                 lis_outcome_service_url:
 *                   type: string
 *       responses:
 *         200:
 *           description: Successful operation
 */
controller.router.use('/:toolId', controller.specTranslator);
exports.default = controller;
