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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import axios from 'axios';
import { AuthGuard, BaseExtensionCtrl, EncryptService } from "clm-core";
import { CourseStructureJSON, loBDTOInstance } from "clm-ext-learning_objects";
import { toolBDTOInstance } from 'clm-ext-tools';
import { generateKeyPair } from 'crypto';
import ejs from 'ejs';
import express from 'express';
import fs from 'fs';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import swaggerJsdoc from 'swagger-jsdoc';
import { v4 as uuid } from 'uuid';
import LaunchService from "../services/LaunchService";
import cmi5controller from './cmi5Controller';
import { ROOT_DIR } from '../../server';



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

const options: swaggerJsdoc.Options = {
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
}
const swaggerSpecification = swaggerJsdoc(options)
const KID = process.env.KID || '1'
const encryptService = new EncryptService(process.env.LOGIN_HINT_ENCRYPT_KEY || 'secret');

const lti11form = fs.readFileSync(ROOT_DIR + '/src/templates/lti11form.ejs').toString()
const lti11formSelf = fs.readFileSync(ROOT_DIR + '/src/templates/lti11formSelf.ejs').toString()

const publicKeyPath = '/src/jwks/public_key.pub';
const privateKeyPath = '/src/jwks/private_key.pem';

let public_key: string, private_key: string;
if (!fs.existsSync(ROOT_DIR + publicKeyPath) || !fs.existsSync(ROOT_DIR + privateKeyPath)) {

    (async () => {

        const { public_key: pubKey, private_key: privKey } = await new Promise((resolve, reject) => {
            generateKeyPair('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            }, (err, public_key, private_key) => {
                if (err) return reject(err)
                return resolve({ public_key, private_key })
            });
        }) as { public_key: string, private_key: string }

        fs.writeFileSync(ROOT_DIR + publicKeyPath, pubKey)
        fs.writeFileSync(ROOT_DIR + privateKeyPath, privKey)



    })();
} else {
    public_key = fs.readFileSync(ROOT_DIR + publicKeyPath, 'utf-8')
    private_key = fs.readFileSync(ROOT_DIR + privateKeyPath, 'utf-8')
}

class LaunchController extends BaseExtensionCtrl {

    specTranslator: express.Handler = async (req, res, next) => {
        console.log('controlling spec')
        let toolId = req.params.toolId;
        const body = req.body;
        const query = req.query;


        try {
            // CMI5 LAUNCH REQUEST
            if (req.query.actor) {
                const { accessToken, email } = LaunchService.validate_cmi5_request(query);
                const { tool, user } = await LaunchService.getUserAndTool(accessToken, email, toolId)
                return LaunchService.launchSpecification(tool.type as any, tool, user, accessToken)(req, res, next)
            }
            // LTI11 LAUNCH REQUEST
            if (req.body.oauth_consumer_key) {

                console.log('here we are')

                const { accessToken, email } = LaunchService.validate_lti11_request(body);
                const { tool, user } = await LaunchService.getUserAndTool(accessToken, email, toolId)
                return LaunchService.launchSpecification(tool.type as any, tool, user, accessToken)(req, res, next)
            }
            //  LTI13 LAUNCH REQUEST
            if (req.query.iss) {
                return res.status(500).json({ message: 'LTI13 currently under development...' })
            }
        } catch (err) {

            return next(err)
        }
        return next({ message: "not supported specification", status: 400 })
    };

    lti11form: express.Handler = (req, res, next) => {
        let launchData = req.query;
        let { redirectUrl, directLaunch, returnUrl, target }: any = launchData;

        let toolTarget = target || launchData['launch_presentation_document_target']

        if (directLaunch == null || directLaunch == undefined) directLaunch = false;

        if (redirectUrl == null || redirectUrl == undefined)
            return next({ message: 'redirectUrl missing', status: 400 });
        delete launchData.redirectUrl;
        delete launchData.directLaunch;
        delete launchData.returnUrl;
        delete launchData.target;

        const launchData_ary = Object.entries(launchData);

        try {
            let form = (toolTarget === '_self') ? lti11formSelf : lti11form
            let html = ejs.render(
                form,
                { launchData_ary, redirectUrl, launchData, returnUrl, target }
            );
            return res.send(html);
        } catch (e) {
            return next({ message: e, status: 500 });
        }
    }

    cmi5form: express.Handler = (req, res, next) => {
        let { redirect_url } = req.query;
        if (redirect_url == null || redirect_url == undefined)
            return next({ message: 'redirectUrl missing', status: 400 });
        try {
            const html = ejs.render(
                `
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
                `,
                { redirect_url }
            );
            res.send(html);
        } catch (e) {
            return next({ message: e, status: 500 });
        }
    }

    lti11_launchData: express.Handler = async (req, res, next) => {
        try {
            return LaunchService.getPrerenderedLTI1_1Launch(req.params.toolId)(req, res, next);
        } catch (err) {
            next(err);
        }
    }

    oidc_auth_endpoint: express.Handler = async (req, res, next) => {
        try {
            const token = req.body.id_token
            if (!token) return next({ message: 'token missing', status: 400 })

            // decode token without verifying
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded) return next({ message: 'token invalid', status: 400 })
            const client_id = (decoded.payload as JwtPayload).aud
            let kid = (decoded.header as JwtHeader).kid
            let login_hint = (decoded.payload as JwtPayload).login_hint
            let redirect_uri = (decoded.payload as JwtPayload).redirect_uri
            let userId;
            userId = encryptService.decrypt(login_hint)
            if (!userId) return next({ message: `not valid loginhint: ${login_hint}`, status: 400 })

            if (!client_id) return next({ message: 'client_id missing', status: 400 })

            const tool = (await toolBDTOInstance.findAll()).find((tool) => {
                return tool.client_id === client_id
            })
            if (!tool) return next({ message: 'tool not found', status: 400 })

            let extendedTool = await CourseStructureJSON.getUserTool(userId, tool._id)
            if (!extendedTool) return next({ message: `user has not access to that tool: ${tool._id}`, status: 400 })

            const { launchableUrl, key_set_url, target_link_uri, roles } = extendedTool

            // axios get jwks from key_set_url
            const jwks = (await axios.get(key_set_url!)).data
            let jwk = jwks.keys.find((jwk: any) => jwk.kid === kid)

            if (!jwk) return res.json({ message: `jwk not found for that id: ${kid}`, status: 400 })

            let public_key = jwk.x5c[0]
            // verify token
            const verified = jwt.verify(token, public_key)
            const lo = await loBDTOInstance.findById(extendedTool.loId!)!
            // lti13 payload
            let payload = {
                iss: process.env.DEPLOY_URL + '/launch',
                sub: login_hint,
                aud: tool.client_id,
                iat: Math.floor(Date.now() / 1000),
                nonce: uuid(),
                'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
                'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
                'https://purl.imsglobal.org/spec/lti/claim/resource_link': '1',
                'https://purl.imsglobal.org/spec/lti/claim/roles': roles,
                'https://purl.imsglobal.org/spec/lti/claim/context': {
                    id: lo!._id,
                    label: lo.displayName,
                    title: lo.displayName,
                    type: [
                        'http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'
                    ]
                },

            }

            jwt.sign(payload, private_key, { expiresIn: '1h', keyid: KID, algorithm: "RS256" }, (err, token) => {
                if (err) return res.status(500).send(err.message)
                // OIDC Authentication Request where the payload is passed as jwt 
                // return res.render('launch', { oidcAuthEndpoint: auth_login_url, token });
                return res.render('launchLTI13tool', { redirect_uri, token })
            })
            // jwt.sign()
        } catch (err) {
            return next(err)
        }
    }

    jwks: express.Handler = async (req, res, next) => {
        try {
            const jwks = {
                keys: [
                    {
                        alg: "RS256",
                        kty: "RSA",
                        use: "sig",
                        x5c: [public_key],
                        kid: KID,
                    }
                ]
            }
            return res.json(jwks)
        } catch (err) {
            return next(err)
        }
    }
}

const controller = new LaunchController();

controller.router.get('/lti-11/:toolId/launchdata', AuthGuard.requireUserAuthentication(), controller.lti11_launchData)
controller.router.get('/cmi5/form', controller.cmi5form)
controller.router.get('/lti-11/form', controller.lti11form)
controller.router.use('/cmi5', cmi5controller.router)

// lti 13 routes
controller.router.post('/oidc/auth', controller.oidc_auth_endpoint)
controller.router.get('/jwks', controller.jwks)
controller.router.use('/swagger', (req, res) => {
    return res.json(swaggerSpecification)
})

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
 *       responses:
 *         200:
 *           description: Successful operation
 */

controller.router.use('/:toolId', controller.specTranslator)



export default controller



